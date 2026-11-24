'use strict';

const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const https = require('https');
const http = require('http');
const net = require('net');
const { EventEmitter } = require('events');
const { buildRoutingRules } = require('./vpn-routing');

const SOCKS_PORT = 10808;
const HTTP_PORT  = 10809;
const XRAY_BIN   = process.platform === 'win32' ? 'xray.exe' : 'xray';

class VpnManager extends EventEmitter {
  constructor(userDataPath) {
    super();
    this.userDataPath = userDataPath;
    this.binPath    = path.join(userDataPath, XRAY_BIN);
    this.configPath = path.join(userDataPath, 'vpn-config.json');
    this.dataPath   = path.join(userDataPath, 'vpn-data.json');
    this.proc       = null;
    this.connected  = false;
    this.current    = null;
    this.servers    = [];
    this.subUrl     = '';
    this.routingMode = 'split-ru';
    this.customBlockedDomains = [];
    this._sessions  = null;
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const d = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
        this.servers = d.servers || [];
        this.subUrl  = d.subUrl  || '';
        this.routingMode = d.routingMode === 'full' ? 'full' : 'split-ru';
        this.customBlockedDomains = Array.isArray(d.customBlockedDomains) ? d.customBlockedDomains : [];
      }
    } catch(e) {}
  }
  _save() {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify({
        servers: this.servers,
        subUrl: this.subUrl,
        routingMode: this.routingMode,
        customBlockedDomains: this.customBlockedDomains,
      }, null, 2));
    } catch(e) {}
  }

  setOptions(opts = {}) {
    if (opts.routingMode === 'full' || opts.routingMode === 'split-ru') {
      this.routingMode = opts.routingMode;
    }
    if (Array.isArray(opts.customBlockedDomains)) {
      this.customBlockedDomains = opts.customBlockedDomains;
    }
    if (typeof opts.subUrl === 'string') this.subUrl = opts.subUrl;
    this._save();
  }

  hasBinary() {
    const candidates = [
      this.binPath,
      path.join(__dirname, XRAY_BIN),
      path.join(__dirname, 'bin', XRAY_BIN),
    ];
    for (const p of candidates) {
      try { if (fs.existsSync(p)) { this.binPath = p; return true; } } catch(e) {}
    }
    return false;
  }

  async downloadBinary(onProgress) {
    const arch = process.arch === 'arm64' ? (process.platform === 'darwin' ? 'arm64-v8a' : 'arm64') : '64';
    const names = {
      win32:  `Xray-windows-${arch}.zip`,
      linux:  `Xray-linux-${arch}.zip`,
      darwin: `Xray-macos-${arch}.zip`,
    };
    const filename = names[process.platform] || names.linux;
    const url      = `https://github.com/XTLS/Xray-core/releases/latest/download/${filename}`;
    const zipPath  = path.join(this.userDataPath, filename);

    await this._download(url, zipPath, onProgress);
    await this._unzip(zipPath, this.userDataPath);
    try { fs.unlinkSync(zipPath); } catch(e) {}
    if (process.platform !== 'win32') {
      try { fs.chmodSync(this.binPath, '755'); } catch(e) {}
    }
    return this.hasBinary();
  }

  _download(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
      const doGet = (u) => {
        https.get(u, { timeout: 30000 }, res => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            doGet(res.headers.location); return;
          }
          const total = parseInt(res.headers['content-length'] || '0');
          let got = 0;
          const file = fs.createWriteStream(dest);
          res.on('data', c => { got += c.length; if (onProgress && total) onProgress(Math.round(got/total*100)); });
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
          res.on('error', reject);
        }).on('error', reject).on('timeout', () => reject(new Error('Download timeout')));
      };
      doGet(url);
    });
  }

  _findBinary(dir, name) {
    const lower = name.toLowerCase();
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === lower) return full;
        if (entry.isDirectory()) {
          const nested = this._findBinary(full, name);
          if (nested) return nested;
        }
      }
    } catch (e) {}
    return null;
  }

  _copyGeoAssets(searchRoot) {
    for (const name of ['geoip.dat', 'geosite.dat']) {
      const found = this._findBinary(searchRoot, name);
      if (!found) continue;
      const target = path.join(this.userDataPath, name);
      try {
        if (path.resolve(found) !== path.resolve(target)) fs.copyFileSync(found, target);
      } catch (e) {}
    }
  }

  _unzip(zipPath, dest) {
    return new Promise((resolve, reject) => {
      try {
        if (process.platform === 'win32') {
          execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`, { timeout: 60000 });
          const found = this._findBinary(dest, 'xray.exe');
          if (!found) {
            reject(new Error('XRAY_EXTRACT_ERROR'));
            return;
          }
          const target = path.join(this.userDataPath, XRAY_BIN);
          if (path.resolve(found) !== path.resolve(target)) {
            fs.copyFileSync(found, target);
          }
          this.binPath = target;
          this._copyGeoAssets(dest);
        } else {
          execSync(`unzip -o "${zipPath}" xray -d "${dest}"`, { timeout: 30000 });
          const found = this._findBinary(dest, 'xray') || path.join(dest, 'xray');
          if (!fs.existsSync(found)) {
            reject(new Error('XRAY_EXTRACT_ERROR'));
            return;
          }
          const target = path.join(this.userDataPath, XRAY_BIN);
          if (path.resolve(found) !== path.resolve(target)) {
            fs.copyFileSync(found, target);
          }
          this.binPath = target;
          fs.chmodSync(this.binPath, 0o755);
          this._copyGeoAssets(dest);
        }
        resolve();
      } catch (e) { reject(e); }
    });
  }

  async fetchSub(url) {
    const data = await this._httpGet(url);
    let servers = this._parseSub(data);
    if (!servers.length) throw new Error('SUB_PARSE_ERROR');
    this.servers = servers;
    this.subUrl  = url;
    this._save();
    return servers;
  }

  addLink(link) {
    link = link.trim();
    const lines  = link.split('\n').map(l => l.trim()).filter(Boolean);
    const added  = [];
    for (const l of lines) {
      const s = this._parseLink(l);
      if (s) {
        if (!this.servers.find(x => x.address === s.address && x.port === s.port && x.uuid === s.uuid))
          this.servers.push(s);
        added.push(s);
      }
    }
    if (!added.length) throw new Error('LINK_FORMAT_ERROR');
    this._save();
    return added;
  }

  removeServer(idx) {
    this.servers.splice(idx, 1);
    this._save();
  }

  async _httpGet(url) {
    try {
      const { net } = require('electron');
      const fetchFunc = net.fetch || fetch;
      const res = await fetchFunc(url, {
        headers: {
          'User-Agent': 'v2rayN/6.23',
          'Accept': '*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        redirect: 'follow'
      });
      if (!res.ok && res.status !== 403) {
        throw new Error('HTTP Error ' + res.status);
      }
      return await res.text();
    } catch (e) {
      throw new Error(e.message || 'Network error');
    }
  }

  _parseSub(raw) {
    try {
      const cleanRaw = raw.replace(/\s+/g, '');
      const dec = Buffer.from(cleanRaw, 'base64').toString('utf8');
      if (dec.includes('://')) {
        const servers = dec.split('\n').map(l => this._parseLink(l.trim())).filter(Boolean);
        if (servers.length) return servers;
      }
    } catch(e) {}
    return raw.split('\n').map(l => this._parseLink(l.trim())).filter(Boolean);
  }

  _parseLink(link) {
    try {
      if (link.startsWith('vmess://')) {
        const cleanB64 = link.slice(8).replace(/\s+/g, '');
        const j = JSON.parse(Buffer.from(cleanB64, 'base64').toString('utf8'));
        return {
          type:    'vmess',
          name:    j.ps || j.add || 'VMess',
          address: j.add,
          port:    parseInt(j.port),
          uuid:    j.id,
          alterId: parseInt(j.aid) || 0,
          network: j.net || 'tcp',
          path:    j.path || '/',
          host:    j.host || '',
          tls:     j.tls === 'tls',
          sni:     j.sni || j.host || '',
          fp:      j.fp || '',
        };
      }
      if (link.startsWith('vless://')) {
        const u = new URL(link.replace('vless://', 'vless-x://'));
        const p = Object.fromEntries(u.searchParams);
        return {
          type:      'vless',
          name:      u.hash ? decodeURIComponent(u.hash.slice(1)) : (u.hostname || 'VLESS'),
          address:   u.hostname,
          port:      parseInt(u.port),
          uuid:      u.username,
          network:   p.type || 'tcp',
          security:  p.security || 'none',
          path:      p.path || '/',
          host:      p.host || '',
          flow:      p.flow || '',
          sni:       p.sni || p.servername || '',
          fp:        p.fp || 'chrome',
          pbk:       p.pbk || '',
          sid:       p.sid || '',
        };
      }
      if (link.startsWith('trojan://')) {
        const u = new URL(link.replace('trojan://', 'trojan-x://'));
        const p = Object.fromEntries(u.searchParams);
        return {
          type:     'trojan',
          name:     u.hash ? decodeURIComponent(u.hash.slice(1)) : (u.hostname || 'Trojan'),
          address:  u.hostname,
          port:     parseInt(u.port),
          uuid:     u.username, // password
          network:  p.type || 'tcp',
          security: p.security || 'tls',
          sni:      p.sni || '',
          fp:       p.fp || 'chrome',
          path:     p.path || '/',
          host:     p.host || '',
        };
      }
      if (link.startsWith('ss://')) {
        let name = 'Shadowsocks';
        let main = link.slice(5);
        if (main.includes('#')) {
          const parts = main.split('#');
          main = parts[0];
          name = decodeURIComponent(parts[1]);
        }
        const atIdx = main.lastIndexOf('@');
        if (atIdx === -1) {
           const dec = Buffer.from(main, 'base64').toString('utf8');
           if (dec.includes('@')) { /* recursion or handle below */ }
        }
        const authPart = main.slice(0, atIdx);
        const serverPart = main.slice(atIdx + 1);
        
        let method, password;
        if (authPart.includes(':')) {
           [method, password] = authPart.split(':');
        } else {
           const decAuth = Buffer.from(authPart, 'base64').toString('utf8');
           [method, password] = decAuth.split(':');
        }
        const [host, port] = serverPart.split(':');
        return {
          type: 'shadowsocks',
          name: name,
          address: host,
          port: parseInt(port),
          method: method,
          password: password
        };
      }
    } catch(e) {}
    return null;
  }

  _buildConfig(server) {
    return {
      log: { loglevel: 'error' },
      dns: {
        servers: [
          'https://1.1.1.1/dns-query',
          '8.8.8.8',
          '8.8.4.4',
          '77.88.8.8',
          'localhost'
        ],
        queryStrategy: 'UseIPv4'
      },
      inbounds: [
        { tag: 'socks', protocol: 'socks', listen: '127.0.0.1', port: SOCKS_PORT, settings: { auth: 'noauth', udp: true } },
        { tag: 'http',  protocol: 'http',  listen: '127.0.0.1', port: HTTP_PORT  },
      ],
      outbounds: [
        this._buildOutbound(server),
        { tag: 'direct', protocol: 'freedom', settings: {} },
        { tag: 'block',  protocol: 'blackhole', settings: {} },
      ],
      routing: buildRoutingRules(this.routingMode, this.customBlockedDomains),
    };
  }

  _buildOutbound(server) {
    const stream = this._buildStream(server);
    if (server.type === 'vmess') return {
      tag: 'proxy', protocol: 'vmess',
      settings: { vnext: [{ address: server.address, port: server.port,
        users: [{ id: server.uuid, alterId: server.alterId || 0, security: 'auto' }] }] },
      streamSettings: stream,
    };
    if (server.type === 'vless') {
      const user = { id: server.uuid, encryption: 'none' };
      if (server.flow) user.flow = server.flow;
      return {
        tag: 'proxy', protocol: 'vless',
        settings: { vnext: [{ address: server.address, port: server.port, users: [user] }] },
        streamSettings: stream,
      };
    }
    if (server.type === 'trojan') return {
      tag: 'proxy', protocol: 'trojan',
      settings: { servers: [{ address: server.address, port: server.port, password: server.uuid }] },
      streamSettings: stream,
    };
    if (server.type === 'shadowsocks') return {
      tag: 'proxy', protocol: 'shadowsocks',
      settings: { servers: [{ address: server.address, port: server.port, method: server.method, password: server.password }] }
    };
  }

  _buildStream(s) {
    const net = s.network || 'tcp';
    const sec = s.security || (s.tls ? 'tls' : 'none');
    const st  = { network: net, security: sec };

    if (net === 'ws')   st.wsSettings   = { path: s.path || '/', headers: s.host ? { Host: s.host } : {} };
    if (net === 'grpc') st.grpcSettings = { serviceName: s.path || '' };
    if (net === 'h2' || net === 'http') st.httpSettings = { path: s.path || '/', host: s.host ? [s.host] : [] };

    if (sec === 'tls') st.tlsSettings = { serverName: s.sni || s.host || s.address, fingerprint: s.fp || 'chrome', allowInsecure: false };
    if (sec === 'reality') st.realitySettings = { serverName: s.sni || s.address, fingerprint: s.fp || 'chrome', publicKey: s.pbk || '', shortId: s.sid || '', show: false };

    return st;
  }

  async pingServer(server) {
    if (!server || !server.address || !server.port) return -1;
    return new Promise(resolve => {
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(2500);
      socket.connect(server.port, server.address, () => {
        const ping = Date.now() - start;
        socket.destroy();
        resolve(ping);
      });
      socket.on('error', () => { socket.destroy(); resolve(-1); });
      socket.on('timeout', () => { socket.destroy(); resolve(-1); });
    });
  }

  async pingAllServers() {
    const results = {};
    for (let i = 0; i < this.servers.length; i++) {
      const ms = await this.pingServer(this.servers[i]);
      results[i] = ms;
    }
    return results;
  }

  async connect(server, sessions) {
    if (!this.hasBinary()) throw new Error('NO_BINARY');
    await this.disconnect(sessions);

    const cfg = this._buildConfig(server);
    fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2));

    this.proc = spawn(this.binPath, ['run', '-c', this.configPath], { cwd: this.userDataPath, stdio: ['ignore', 'pipe', 'pipe'] });
    this.proc.stderr.on('data', d => { if (d.toString().includes('error')) this.emit('log', d.toString()); });
    this.proc.on('exit', code => {
      if (this.connected) { this.connected = false; this.current = null; this.emit('status', this.getStatus()); }
    });

    await new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const sock = new net.Socket();
        sock.connect(SOCKS_PORT, '127.0.0.1', () => { sock.destroy(); resolve(); });
        sock.on('error', () => { sock.destroy(); if (Date.now() - start > 8000) reject(new Error('XRAY_START_ERROR')); else setTimeout(check, 300); });
      };
      check();
    });

    const proxyConfig = {
      proxyRules: `http=127.0.0.1:${HTTP_PORT};https=127.0.0.1:${HTTP_PORT};socks=127.0.0.1:${SOCKS_PORT}`,
      proxyBypassRules: '<local>,127.0.0.1,localhost,::1,*.local',
    };
    this._sessions = sessions || [];
    for (const ses of this._sessions) {
      try { await ses.setProxy(proxyConfig); } catch(e) {}
    }

    this.connected = true;
    this.current   = server;
    this._save();
    this.emit('status', this.getStatus());
  }

  async reconnect(sessions) {
    if (!this.connected || !this.current) return;
    const server = this.current;
    await this.connect(server, sessions || this._sessions);
  }

  async disconnect(sessions) {
    if (this.proc) { try { this.proc.kill('SIGTERM'); } catch(e) {} this.proc = null; }
    for (const ses of (sessions || [])) { try { await ses.setProxy({ proxyRules: '', proxyBypassRules: '' }); } catch(e) {} }
    this.connected = false;
    this.current   = null;
    this._sessions = null;
    this.emit('status', this.getStatus());
  }

  getStatus() {
    return {
      connected:  this.connected,
      current:    this.current,
      servers:    this.servers,
      subUrl:     this.subUrl,
      routingMode: this.routingMode,
      hasBinary:  this.hasBinary(),
      socksPort:  SOCKS_PORT,
      httpPort:   HTTP_PORT,
    };
  }
}

module.exports = VpnManager;


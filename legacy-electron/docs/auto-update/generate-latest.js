// Скрипт для генерации latest.yml вручную
// Использование: node generate-latest.js [версия] [путь-к-exe]
// Пример: node generate-latest.js 2.0.1 "dist/Visibility Browser Setup 2.0.1.exe"

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const version = process.argv[2];
const exePath = process.argv[3];

if (!version || !exePath) {
    console.log('Использование: node generate-latest.js [версия] [путь-к-exe]');
    console.log('Пример: node generate-latest.js 2.0.1 "dist/Visibility Browser Setup 2.0.1.exe"');
    process.exit(1);
}

if (!fs.existsSync(exePath)) {
    console.error('ОШИБКА: Файл не найден:', exePath);
    process.exit(1);
}

// Получаем размер файла
const stats = fs.statSync(exePath);
const size = stats.size;

// Вычисляем SHA512
const fileBuffer = fs.readFileSync(exePath);
const hash = crypto.createHash('sha512').update(fileBuffer).digest('base64');

// Имя файла
const fileName = path.basename(exePath);

// Генерируем YAML
const ymlContent = `version: ${version}
files:
  - url: ${fileName}
    sha512: ${hash}
    size: ${size}
path: ${fileName}
sha512: ${hash}
releaseDate: '${new Date().toISOString()}'
`;

// Сохраняем
const outputPath = path.join(path.dirname(exePath), 'latest.yml');
fs.writeFileSync(outputPath, ymlContent);

console.log('Готово! Файл latest.yml создан:');
console.log(outputPath);
console.log('\nСодержимое:');
console.log(ymlContent);

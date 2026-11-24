import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import json
import base64
import urllib.parse
import os

def encode_extension(data_str, is_official, is_verified):
    data = json.loads(data_str)
    if "manifest" not in data:
        data["manifest"] = {}
    
    data["manifest"]["is_official"] = is_official
    data["manifest"]["is_verified"] = is_verified
    
    json_str = json.dumps(data)
    url_encoded = urllib.parse.quote(json_str)
    b64_encoded = base64.b64encode(url_encoded.encode('utf-8')).decode('utf-8')
    reversed_b64 = "".join(reversed(b64_encoded))
    
    return "VISIB_ENC:" + reversed_b64

def select_file():
    filepath = filedialog.askopenfilename(filetypes=[("Visibility Extensions", "*.visibility"), ("JSON Files", "*.json"), ("All Files", "*.*")])
    if filepath:
        file_path_var.set(filepath)

def process_file():
    filepath = file_path_var.get()
    if not filepath:
        messagebox.showerror("Ошибка", "Пожалуйста, выберите файл .visibility!")
        return
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        is_official = var_official.get()
        is_verified = var_verified.get()
        
        # Validation
        try:
            json.loads(content)
        except json.JSONDecodeError:
            messagebox.showerror("Ошибка", "Файл не является валидным JSON!")
            return
            
        encrypted = encode_extension(content, is_official, is_verified)
        
        orig_name = os.path.basename(filepath)
        save_path = filedialog.asksaveasfilename(
            initialfile=orig_name,
            defaultextension=".visibility", 
            filetypes=[("Visibility Extensions", "*.visibility")]
        )
        if save_path:
            with open(save_path, 'w', encoding='utf-8') as f:
                f.write(encrypted)
            messagebox.showinfo("Успех", "Расширение успешно зашифровано и сохранено!")
            
    except Exception as e:
        messagebox.showerror("Ошибка", f"Произошла ошибка:\n{str(e)}")

root = tk.Tk()
root.title("Visibility Extension Packager")
root.geometry("450x300")
root.configure(bg="#1e1e20")
root.resizable(False, False)

style = ttk.Style(root)
if 'clam' in style.theme_names():
    style.theme_use('clam')
style.configure('TCheckbutton', background="#1e1e20", foreground="white", font=("Segoe UI", 10))
style.configure('TButton', font=("Segoe UI", 10))

title_label = tk.Label(root, text="Упаковщик расширений VISIB", font=("Segoe UI", 16, "bold"), bg="#1e1e20", fg="white")
title_label.pack(pady=15)

file_path_var = tk.StringVar()

frame_file = tk.Frame(root, bg="#1e1e20")
frame_file.pack(pady=10, fill='x', padx=20)

entry_file = tk.Entry(frame_file, textvariable=file_path_var, font=("Segoe UI", 10), state="readonly", width=35)
entry_file.pack(side="left", padx=(0, 10))

btn_browse = ttk.Button(frame_file, text="Обзор...", command=select_file)
btn_browse.pack(side="left")

frame_opts = tk.Frame(root, bg="#1e1e20")
frame_opts.pack(pady=15, fill='x', padx=20)

var_official = tk.BooleanVar()
var_verified = tk.BooleanVar()

def on_official_change(*args):
    if var_official.get():
        var_verified.set(False)

def on_verified_change(*args):
    if var_verified.get():
        var_official.set(False)

var_official.trace_add("write", on_official_change)
var_verified.trace_add("write", on_verified_change)

chk_official = ttk.Checkbutton(frame_opts, text="Расширение от разработчиков Visibility (✔️)", variable=var_official)
chk_official.pack(anchor="w", pady=5)

chk_verified = ttk.Checkbutton(frame_opts, text="Расширение прошло официальную проверку (🛡️)", variable=var_verified)
chk_verified.pack(anchor="w", pady=5)

btn_pack = tk.Button(root, text="Зашифровать и Сохранить", command=process_file, font=("Segoe UI", 11, "bold"), bg="#4caf50", fg="white", activebackground="#45a049", activeforeground="white", borderwidth=0, padx=15, pady=8)
btn_pack.pack(pady=10)

root.mainloop()

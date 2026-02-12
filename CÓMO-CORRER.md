# Cómo correr la tienda en tu Mac

Si ves **"This page isn't working"** o **"127.0.0.1 sent an invalid response"**, seguí estos pasos.

## 1. Cerrar lo que use el puerto 3000

En **Terminal.app** (no la terminal de Cursor) ejecutá:

```bash
kill $(lsof -t -i:3000) 2>/dev/null
```

Si dice que no hay proceso, está bien.

## 2. Entrar al proyecto y levantar el servidor

```bash
cd /Users/deboraquinteros/Proyectos/tienda-mates
npm run build
npm run start
```

Abrí en el navegador: **http://127.0.0.1:3000**

---

## Si el puerto 3000 sigue ocupado

Usá otro puerto:

```bash
npm run start:3002
```

Y abrí: **http://127.0.0.1:3002**

---

## Modo desarrollo (recarga al guardar)

```bash
kill $(lsof -t -i:3000) 2>/dev/null
cd /Users/deboraquinteros/Proyectos/tienda-mates
npm run dev
```

Luego **http://127.0.0.1:3000**

---

**Importante:** ejecutá estos comandos en **Terminal.app** (o iTerm), no en la terminal integrada de Cursor, para evitar errores de red del sistema.

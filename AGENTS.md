# Guía para Agentes - GameVault

## Reglas Críticas (Lo que NO debes hacer)
1. **NO ejecutes `npm install` o `bun add`** sin autorización explícita del usuario.
2. **NO explores ni abras carpetas pesadas**: evita `backend/node_modules`, `dist` o `.git`.
3. **NO reescribas archivos completos**: usa ediciones quirúrgicas y puntuales (`replace_file_content`).
4. **NO introduzcas emojis** en la interfaz del frontend; usa FontAwesome 6 (`<i class="fa-solid fa-..."></i>`) o clases CSS.
5. **NO rompas el fallback offline**: las llamadas en `pos.js`, `app.js` e `inventario.js` deben seguir funcionando contra `localStorage` si el backend no responde.

## Alcance y Áreas de Trabajo
- **Frontend**: Modifica exclusivamente archivos dentro de `frontend/` (`*.html`, `css/style.css`, `js/*.js`).
- **Backend**: Modifica exclusivamente archivos dentro de `backend/src/` y `backend/prisma/`.
- Mantén consistencia en endpoints que comiencen con `/api` mediante el helper `apiFetch`.

## Convenciones de Código
- **Estilos**: Tailwind CSS combinado con variables en `frontend/css/style.css`.
- **Badges de estado**: Clases redondeadas completas (`rounded-full`), tipografía mono (`text-[10px] font-mono font-bold`), fondos pastel suaves (`bg-<color>-500/10`) y bordes sutiles (`border-<color>-500/30`).
- **Iconografía**: FontAwesome 6 CDN ya incluido en el `<head>` de los HTML.
- **Variables y Funciones**: CamelCase en JavaScript/TypeScript, nombres explicativos en español/inglés acorde al contexto existente.

## Estilo de Respuesta
- Responde siempre en **español**.
- Sé conciso, directo al grano y ahorrador de tokens; evita explicaciones redundantes.
- Provee enlaces en formato Markdown a los archivos modificados.

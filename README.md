# Galipelis (Frontend)

Interfaz web y cliente para Smart TV de la plataforma multimedia Galipelis (GaliPTV). Diseñada bajo estándares de arquitectura corporativa (*enterprise grade*) con tecnologías web nativas puras (Vanilla HTML5, CSS3 y JavaScript ES6+), optimizada para máxima velocidad y navegación fluida mediante teclado y mando a distancia.

---

## Arquitectura del Proyecto (Estructura Espejo)

El proyecto respeta de forma estricta el patrón de simetría 1:1 entre tecnologías, garantizando una separación absoluta de responsabilidades sin librerías pesadas ni estilos/scripts en línea:

```text
galipelis/
├── html/
│   ├── inicio/
│   │   └── inicio.html          # Vista principal: Catálogo por categorías (TV, Películas, Series)
│   ├── reproductor/
│   │   └── reproductor.html     # Vista de reproducción a pantalla completa (OSD para Smart TV)
│   └── admin/
│       └── admin.html           # Panel de administración, gestión de usuarios y métricas
├── css/
│   ├── comun/
│   │   ├── variables.css        # Tokens centralizados (:root): colores, tipografía, radios
│   │   └── normalizacion.css    # Reseteo y normalización técnica CSS
│   ├── inicio/
│   │   └── inicio.css           # Estilos de la vista de catálogo
│   ├── reproductor/
│   │   └── reproductor.css      # Estilos del reproductor y controles OSD
│   └── admin/
│       └── admin.css            # Estilos del panel de control
├── js/
│   ├── comun/
│   │   ├── utilidades.js        # Formateo de tiempo, manejo seguro del DOM y resolución de backend
│   │   └── navegacion-mando.js  # Motor de navegación espacial mediante D-Pad / cruceta
│   ├── inicio/
│   │   └── inicio.js            # Lógica de renderizado y filtrado de catálogo
│   ├── reproductor/
│   │   └── reproductor.js       # Integración HLS/MPEG-TS y telemetría de reproducción
│   └── admin/
│       └── admin.js             # Lógica del panel de administración
├── LogoGaliIptv.png             # Logotipo corporativo
├── favicon.ico                  # Favicon del proyecto
├── index.html                   # Punto de entrada y redirección a html/inicio/inicio.html
└── .gitignore                   # Ficheros ignorados
```

---

## Principios de Diseño y Calidad

- **Navegación espacial nativa:** Diseñado para responder a las teclas del mando a distancia (Cruceta arriba/abajo/izquierda/derecha, Intro/OK, Atrás/Escape).
- **Cero dependencias pesadas:** Construido sin frameworks reactivos (sin React, Vue o Angular), logrando tiempos de carga instantáneos en navegadores con recursos limitados (WebOS, Tizen, Android TV).
- **Diseño sobrio y profesional:** Paleta técnica con tonos neutros profundos, un único acento funcional y ausencia total de emojis en favor de iconografía vectorial SVG de trazo fino.
- **Resolución dinámica del backend:** La capa utilitaria (`Utilidades.obtenerUrlBackend()`) detecta automáticamente la ubicación del servidor de backend (`galipelis_backend`) tanto en despliegues con el mismo origen como en desarrollo local desacoplado (puerto 6543) o entornos remotos personalizables mediante `localStorage.getItem('galipelis_backend_url')`.

---

## Puesta en Marcha en Desarrollo

Al ser una aplicación web estática pura, puede servirse con cualquier servidor HTTP:

### Con Python

```bash
python3 -m http.server 3000
```
Abrir `http://localhost:3000` en el navegador.

### Con Live Server (VS Code / VSCodium)
Hacer clic derecho sobre `index.html` o `html/inicio/inicio.html` y seleccionar **"Open with Live Server"**.

### Con Nginx
Apuntar la raíz del servidor virtual al directorio del proyecto.

> [!NOTE]
> Para comunicarse con la API y los proxies de vídeo, asegúrate de tener en ejecución el repositorio hermano `galipelis_backend` (por defecto en el puerto `6543`).

---

## Flujo de Trabajo Git (Feature Branching)

Este repositorio utiliza el flujo de trabajo de ramas por funcionalidad:

1. **`main`**: Rama protegida de producción. Representa el código probado y estable.
2. **`develop`**: Rama base para el desarrollo continuo e integración de características.
3. **Ramas de funcionalidad (`feature/*`)**: Cada nueva vista, componente o refactorización debe nacer de `develop`:
   ```bash
   # Asegurar estado actualizado de develop
   git checkout develop
   git pull origin develop

   # Crear nueva rama de característica
   git checkout -b feature/nombre-de-la-funcionalidad

   # Desarrollar y confirmar cambios con commits semánticos
   git add .
   git commit -m "feat(catalogo): implementar filtro rápido por año"

   # Subir rama a GitHub
   git push -u origin feature/nombre-de-la-funcionalidad
   ```
4. **Ramas de corrección (`hotfix/*`)**: Para parches críticos directamente sobre `main`.
5. **Convención de commits (Conventional Commits):**
   - `feat:` Nueva funcionalidad para el usuario.
   - `fix:` Arreglo de un fallo o error visual.
   - `style:` Ajustes cosméticos o de maquetación CSS sin alterar lógica.
   - `refactor:` Reestructuración interna de código.
   - `docs:` Actualización de documentación.
   - `chore:` Tareas auxiliares de configuración o mantenimiento.
/**
 * Utilidades Generales y Manejo Seguro del DOM
 * Directrices: /home/oierst/.gemini/GEMINI.md
 */

const Utilidades = (() => {
    'use strict';

    /**
     * Formatea segundos a formato HH:MM:SS o MM:SS
     * @param {number} segundos 
     * @returns {string}
     */
    function formatearTiempo(segundos) {
        if (!segundos || isNaN(segundos) || segundos < 0) return '00:00';
        const total = Math.floor(segundos);
        const hrs = Math.floor(total / 3600);
        const min = Math.floor((total % 3600) / 60);
        const seg = total % 60;

        const pad = (n) => String(n).padStart(2, '0');
        if (hrs > 0) {
            return `${hrs}:${pad(min)}:${pad(seg)}`;
        }
        return `${pad(min)}:${pad(seg)}`;
    }

    /**
     * Extrae el año de un texto (e.g. "Matrix (1999)" -> "1999")
     * @param {string} texto 
     * @returns {string|null}
     */
    function extraerAno(texto) {
        if (!texto) return null;
        const coincidencia = texto.match(/\b(19\d{2}|20\d{2})\b/);
        return coincidencia ? coincidencia[1] : null;
    }

    /**
     * Debounce de ejecución de funciones
     * @param {Function} func 
     * @param {number} espera 
     * @returns {Function}
     */
    function debounce(func, espera = 200) {
        let temporizador;
        return function (...args) {
            clearTimeout(temporizador);
            temporizador = setTimeout(() => func.apply(this, args), espera);
        };
    }

    /**
     * Resuelve la URL base del backend para llamadas de API y proxies
     * Permite sobreescritura dinámica en localStorage o detección automática para desarrollo local
     * @returns {string} URL base sin barra final
     */
    function obtenerUrlBackend() {
        const urlConfigurada = localStorage.getItem('galipelis_backend_url');
        if (urlConfigurada && urlConfigurada.trim()) {
            return urlConfigurada.trim().replace(/\/+$/, '');
        }

        // Detección automática para desarrollo local si frontend se sirve en otro puerto
        const puertoBackend = '6543';
        if (window.location.port && window.location.port !== puertoBackend && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return `${window.location.protocol}//${window.location.hostname}:${puertoBackend}`;
        }

        return window.location.origin;
    }

    /**
     * Permite configurar o restablecer la URL del backend
     * @param {string|null} url 
     */
    function establecerUrlBackend(url) {
        if (url && typeof url === 'string' && url.trim()) {
            localStorage.setItem('galipelis_backend_url', url.trim().replace(/\/+$/, ''));
        } else {
            localStorage.removeItem('galipelis_backend_url');
        }
    }

    /**
     * Genera o retorna una URL segura para imágenes evitando mixturas HTTP/HTTPS y bloqueos
     * @param {string} url 
     * @returns {string}
     */
    function obtenerUrlImagenSegura(url) {
        if (!url || typeof url !== 'string' || !url.trim()) {
            return '';
        }
        const recortada = url.trim();
        if (recortada.startsWith('data:') || recortada.startsWith('blob:')) {
            return recortada;
        }
        if (recortada.startsWith('/')) {
            return `${obtenerUrlBackend()}${recortada}`;
        }
        // Usar proxy del backend para evitar problemas de CORS o HTTP mixto
        return `${obtenerUrlBackend()}/img_proxy/${encodeURIComponent(recortada)}`;
    }

    /**
     * SVG de respaldo limpio y sobrio en caso de error de imagen
     * @returns {string} data URI
     */
    function obtenerImagenRespaldo() {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300" fill="#12141a">' +
            '<rect width="200" height="300" fill="#12141a"/>' +
            '<rect x="1" y="1" width="198" height="298" fill="none" stroke="#27272a" stroke-width="2"/>' +
            '<path d="M70 120 L100 90 L130 120" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
            '<circle cx="85" cy="100" r="5" fill="#71717a"/>' +
            '<text x="100" y="180" fill="#71717a" font-family="sans-serif" font-size="12" font-weight="500" text-anchor="middle">Sin imagen</text>' +
            '</svg>'
        );
    }

    /**
     * Limpia un contenedor eliminando todos sus hijos de forma segura
     * @param {HTMLElement} elemento 
     */
    function vaciarElemento(elemento) {
        if (!elemento) return;
        while (elemento.firstChild) {
            elemento.removeChild(elemento.firstChild);
        }
    }

    /**
     * Crea un elemento SVG inline de forma segura
     * @param {string} viewBox 
     * @param {string} contenidoPath 
     * @param {number} tamano 
     * @returns {SVGElement}
     */
    function crearIconoSVG(viewBox, contenidoPath, tamano = 20) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', viewBox);
        svg.setAttribute('width', String(tamano));
        svg.setAttribute('height', String(tamano));
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.75');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = contenidoPath; // Contenido interno seguro de trazos estáticos
        return svg;
    }

    return {
        formatearTiempo,
        extraerAno,
        debounce,
        obtenerUrlBackend,
        establecerUrlBackend,
        obtenerUrlImagenSegura,
        obtenerImagenRespaldo,
        vaciarElemento,
        crearIconoSVG
    };
})();

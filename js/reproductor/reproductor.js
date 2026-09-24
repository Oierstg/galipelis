/**
 * Lógica del Reproductor a Pantalla Completa (reproductor.js) — Smart TV
 * Directrices: /home/oierst/.gemini/GEMINI.md
 */

(() => {
    'use strict';

    const BASE_PROXY = typeof Utilidades !== 'undefined' && Utilidades.obtenerUrlBackend ? Utilidades.obtenerUrlBackend() : window.location.origin;

    let hlsInstancia = null;
    let mpegtsInstancia = null;
    let temporizadorOsd = null;
    let usuarioActual = localStorage.getItem('gali_user') || 'admin';
    let canalActual = null;
    let esVod = false;

    /* Elementos DOM */
    let videoEl, capaOsd, btnVolver, tituloRep, subtituloRep, avisoSalto, anilloProgreso;
    let filaTiempo, tiempoCur, tiempoTot, rellenoTiempo, punteroTiempo;
    let btnPlayPause, btnRetroceder, btnAvanzar, btnMute, btnAudio, menuAudio, btnSubs, menuSubs, btnFullscreen;

    document.addEventListener('DOMContentLoaded', () => {
        vincularElementos();
        vincularEventos();
        NavegacionMando.inicializar();
        iniciarDesdeParametros();
    });

    function vincularElementos() {
        videoEl         = document.getElementById('elemento-video');
        capaOsd         = document.getElementById('capa-interfaz-reproductor');
        btnVolver       = document.getElementById('boton-volver');
        tituloRep       = document.getElementById('titulo-reproductor');
        subtituloRep    = document.getElementById('subtitulo-reproductor');
        avisoSalto      = document.getElementById('aviso-salto-temporal');
        anilloProgreso  = document.getElementById('anillo-progreso-reproductor');
        filaTiempo      = document.getElementById('fila-linea-tiempo');
        tiempoCur       = document.getElementById('tiempo-actual');
        tiempoTot       = document.getElementById('tiempo-total');
        rellenoTiempo   = document.getElementById('relleno-linea-tiempo');
        punteroTiempo   = document.getElementById('puntero-linea-tiempo');
        btnPlayPause    = document.getElementById('boton-reproducir-pausar');
        btnRetroceder   = document.getElementById('boton-retroceder-10s');
        btnAvanzar      = document.getElementById('boton-avanzar-10s');
        btnMute         = document.getElementById('boton-silenciar');
        btnAudio        = document.getElementById('boton-audio');
        menuAudio       = document.getElementById('menu-audio');
        btnSubs         = document.getElementById('boton-subtitulos');
        menuSubs        = document.getElementById('menu-subtitulos');
        btnFullscreen   = document.getElementById('boton-pantalla-completa');
    }

    function vincularEventos() {
        btnVolver.addEventListener('click', volverAlCatalogo);
        btnPlayPause.addEventListener('click', alternarPlayPause);
        btnRetroceder.addEventListener('click', () => saltarSegundos(-10));
        btnAvanzar.addEventListener('click', () => saltarSegundos(10));
        btnMute.addEventListener('click', alternarSilencio);
        btnFullscreen.addEventListener('click', alternarPantallaCompleta);

        videoEl.addEventListener('play', () => actualizarIconoPlayPausa(true));
        videoEl.addEventListener('pause', () => actualizarIconoPlayPausa(false));
        videoEl.addEventListener('waiting', () => anilloProgreso.classList.remove('oculto'));
        videoEl.addEventListener('playing', () => anilloProgreso.classList.add('oculto'));
        videoEl.addEventListener('timeupdate', actualizarTiempo);

        // Control de teclado y mando a distancia en el reproductor
        window.addEventListener('keydown', manejarTeclasMando);
        document.addEventListener('mousemove', mostrarOsd);

        // Registro de tecla atrás del mando para volver al catálogo
        NavegacionMando.registrarManejadorAtras(() => {
            volverAlCatalogo();
            return true;
        });
    }

    function iniciarDesdeParametros() {
        const params = new URLSearchParams(window.location.search);
        const rawUrl = params.get('url');
        const nombre = params.get('nombre') || 'Emisión en directo';
        const grupo = params.get('grupo') || 'GaliPTV';
        const tipo = params.get('tipo') || 'Live TV';
        const id = params.get('id') || nombre;

        if (!rawUrl) {
            tituloRep.textContent = 'Enlace de emisión no especificado';
            return;
        }

        canalActual = { url: rawUrl, name: nombre, group: grupo, category: tipo, id: id };
        tituloRep.textContent = nombre;
        subtituloRep.textContent = grupo;

        esVod = rawUrl.includes('.mp4') || rawUrl.includes('.mkv');
        filaTiempo.classList.toggle('oculto', !esVod);

        cargarStream(rawUrl);
        NavegacionMando.enfocarElemento(btnPlayPause);
        mostrarOsd();
    }

    function cargarStream(streamUrl) {
        let finalUrl = streamUrl;
        if (finalUrl.startsWith('https://av-ext.com:8443/')) {
            finalUrl = finalUrl.replace('https://av-ext.com:8443/', esVod ? `${BASE_PROXY}/remux/` : `${BASE_PROXY}/transcode_ts/`);
        } else if (finalUrl.startsWith('http://av-ext.com:8443/')) {
            finalUrl = finalUrl.replace('http://av-ext.com:8443/', esVod ? `${BASE_PROXY}/remux/` : `${BASE_PROXY}/transcode_ts/`);
        } else if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
            finalUrl = `${BASE_PROXY}/${esVod ? 'remux_url' : 'transcode_ts_url'}/${encodeURIComponent(finalUrl)}`;
        }

        detener();

        if (esVod) {
            videoEl.src = finalUrl;
            videoEl.play().catch(() => {});
        } else if (finalUrl.includes('.m3u8') && Hls.isSupported()) {
            hlsInstancia = new Hls({ maxMaxBufferLength: 30 });
            hlsInstancia.loadSource(finalUrl);
            hlsInstancia.attachMedia(videoEl);
            hlsInstancia.on(Hls.Events.MANIFEST_PARSED, () => videoEl.play().catch(() => {}));
        } else if (typeof mpegts !== 'undefined' && mpegts.isSupported()) {
            mpegtsInstancia = mpegts.createPlayer({
                type: 'mpegts',
                isLive: true,
                url: finalUrl
            }, {
                enableWorker: true,
                liveBufferLatencyChasing: true
            });
            mpegtsInstancia.attachMediaElement(videoEl);
            mpegtsInstancia.load();
            mpegtsInstancia.play().catch(() => {});
        } else {
            videoEl.src = finalUrl;
            videoEl.play().catch(() => {});
        }
    }

    function detener() {
        if (hlsInstancia) {
            hlsInstancia.destroy();
            hlsInstancia = null;
        }
        if (mpegtsInstancia) {
            try {
                mpegtsInstancia.unload();
                mpegtsInstancia.detachMediaElement();
                mpegtsInstancia.destroy();
            } catch (e) {}
            mpegtsInstancia = null;
        }
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
    }

    function alternarPlayPause() {
        if (videoEl.paused) {
            videoEl.play();
        } else {
            videoEl.pause();
        }
        mostrarOsd();
    }

    function actualizarIconoPlayPausa(jugando) {
        btnPlayPause.querySelector('.icono-reproducir').classList.toggle('oculto', jugando);
        btnPlayPause.querySelector('.icono-pausar').classList.toggle('oculto', !jugando);
    }

    function saltarSegundos(seg) {
        if (!videoEl.duration) return;
        videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + seg));
        avisoSalto.textContent = seg > 0 ? `+${seg}s` : `${seg}s`;
        avisoSalto.classList.remove('oculto');
        setTimeout(() => avisoSalto.classList.add('oculto'), 800);
        mostrarOsd();
    }

    function alternarSilencio() {
        videoEl.muted = !videoEl.muted;
        btnMute.querySelector('.icono-sonido').classList.toggle('oculto', videoEl.muted);
        btnMute.querySelector('.icono-silencio').classList.toggle('oculto', !videoEl.muted);
        mostrarOsd();
    }

    function alternarPantallaCompleta() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    function actualizarTiempo() {
        if (!esVod || !videoEl.duration) return;
        const c = videoEl.currentTime;
        const d = videoEl.duration;
        tiempoCur.textContent = Utilidades.formatearTiempo(c);
        tiempoTot.textContent = Utilidades.formatearTiempo(d);
        const p = (c / d) * 100;
        rellenoTiempo.style.width = `${p}%`;
        punteroTiempo.style.left = `${p}%`;
    }

    function mostrarOsd() {
        capaOsd.classList.remove('inactiva');
        clearTimeout(temporizadorOsd);
        temporizadorOsd = setTimeout(() => {
            if (!videoEl.paused) {
                capaOsd.classList.add('inactiva');
            }
        }, 3500);
    }

    function manejarTeclasMando(e) {
        mostrarOsd();
        if (e.key === 'ArrowLeft') {
            if (esVod) saltarSegundos(-10);
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            if (esVod) saltarSegundos(10);
            e.preventDefault();
        } else if (e.key === ' ' || e.key === 'Enter') {
            if (document.activeElement === videoEl || document.activeElement === document.body) {
                alternarPlayPause();
                e.preventDefault();
            }
        }
    }

    async function volverAlCatalogo() {
        if (canalActual && esVod && videoEl.duration) {
            try {
                const cur = Math.floor(videoEl.currentTime);
                const dur = Math.floor(videoEl.duration);
                const id = String(canalActual.id || canalActual.name);

                await fetch(`${BASE_PROXY}/api/user/data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: usuarioActual,
                        progress: {
                            [id]: {
                                currentTime: cur,
                                duration: dur,
                                percentage: Math.min(100, Math.floor((cur / dur) * 100)),
                                completed: cur >= (dur * 0.9)
                            }
                        }
                    })
                });
            } catch (e) {}
        }

        detener();
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '../inicio/inicio.html';
        }
    }

})();

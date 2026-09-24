/**
 * Motor de Navegación Espacial 2D para Mandos a Distancia de Smart TV (D-Pad)
 * Soporta: Android TV, Fire TV, LG webOS, Samsung Tizen, Teclado PC.
 * Directrices: /home/oierst/.gemini/GEMINI.md
 */

const NavegacionMando = (() => {
    'use strict';

    // Registro de teclas del mando a distancia
    const TECLAS_DIRECCION = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const TECLAS_SELECCION = ['Enter', ' ', 'Select'];
    const CODIGOS_ATRAS = ['Escape', 'Backspace', 'BrowserBack', 'GoBack', 'XF86Back'];
    const NUMEROS_CODIGO_ATRAS = [27, 8, 461, 10009, 10007, 88, 166];

    let elementoPrevioFoco = null;
    let manejadorAtrasPersonalizado = null;

    /**
     * Verifica si una tecla corresponde al botón "Atrás" o "Volver" del mando
     */
    function esTeclaAtras(evento) {
        return CODIGOS_ATRAS.includes(evento.key) || NUMEROS_CODIGO_ATRAS.includes(evento.keyCode);
    }

    /**
     * Obtiene el contenedor modal activo si existe alguno abierto
     */
    function obtenerModalActivo() {
        const modales = document.querySelectorAll('.capa-modal:not(.oculto), .reproductor-overlay:not(.oculto)');
        for (const modal of modales) {
            if (modal.offsetWidth > 0 && modal.offsetHeight > 0) {
                return modal;
            }
        }
        return null;
    }

    /**
     * Obtiene todos los elementos interactivos visibles dentro de un contexto
     */
    function obtenerElementosInteractivos(contenedor = document) {
        const selectores = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex="0"]',
            '.tarjeta-contenido',
            '.boton-navegacion',
            '.pildora-filtro'
        ].join(', ');

        const elementos = Array.from(contenedor.querySelectorAll(selectores));
        return elementos.filter(el => {
            if (el.classList.contains('oculto') || el.closest('.oculto')) return false;
            if (el.disabled) return false;
            const estilo = window.getComputedStyle(el);
            if (estilo.display === 'none' || estilo.visibility === 'hidden' || estilo.opacity === '0') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
    }

    /**
     * Centra un elemento en pantalla y en su contenedor horizontal con scroll suave
     */
    function enfocarElemento(elemento, guardarPrevio = true) {
        if (!elemento) return;

        const enModoMando = document.body.classList.contains('modo-mando');
        if (!enModoMando) return;

        if (guardarPrevio && document.activeElement && document.activeElement !== document.body) {
            elementoPrevioFoco = document.activeElement;
        }

        // Solo mostrar indicador visual y enfocar si se está utilizando el mando/flechas
        document.querySelectorAll('.foco-activo').forEach(el => el.classList.remove('foco-activo'));
        elemento.classList.add('foco-activo');
        elemento.focus({ preventScroll: true });

        // Ajuste en carruseles horizontales únicamente con mando
        const carruselPista = elemento.closest('.fila-carrusel-pista');
        if (carruselPista) {
            const contenedorRect = carruselPista.getBoundingClientRect();
            const elemRect = elemento.getBoundingClientRect();
            const offset = (elemRect.left + elemRect.width / 2) - (contenedorRect.left + contenedorRect.width / 2);
            carruselPista.scrollBy({ left: offset, behavior: 'smooth' });
        }
        elemento.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    /**
     * Calcula la distancia angular y ponderada en una dirección específica
     */
    function calcularPuntuacionDireccional(rectOrigen, rectDestino, direccion) {
        const centroOrigenX = rectOrigen.left + rectOrigen.width / 2;
        const centroOrigenY = rectOrigen.top + rectOrigen.height / 2;
        const centroDestinoX = rectDestino.left + rectDestino.width / 2;
        const centroDestinoY = rectDestino.top + rectDestino.height / 2;

        const deltaX = centroDestinoX - centroOrigenX;
        const deltaY = centroDestinoY - centroOrigenY;

        let distanciaPrincipal = 0;
        let distanciaSecundaria = 0;

        switch (direccion) {
            case 'ArrowRight':
                if (rectDestino.left < rectOrigen.right - 10) return Infinity; // Debe estar a la derecha
                distanciaPrincipal = rectDestino.left - rectOrigen.right;
                distanciaSecundaria = Math.abs(deltaY);
                break;
            case 'ArrowLeft':
                if (rectDestino.right > rectOrigen.left + 10) return Infinity; // Debe estar a la izquierda
                distanciaPrincipal = rectOrigen.left - rectDestino.right;
                distanciaSecundaria = Math.abs(deltaY);
                break;
            case 'ArrowDown':
                if (rectDestino.top < rectOrigen.bottom - 10) return Infinity; // Debe estar abajo
                distanciaPrincipal = rectDestino.top - rectOrigen.bottom;
                distanciaSecundaria = Math.abs(deltaX);
                break;
            case 'ArrowUp':
                if (rectDestino.bottom > rectOrigen.top + 10) return Infinity; // Debe estar arriba
                distanciaPrincipal = rectOrigen.top - rectDestino.bottom;
                distanciaSecundaria = Math.abs(deltaX);
                break;
        }

        if (distanciaPrincipal < 0) return Infinity;

        // Ponderar la distancia secundaria (ortogonal) para priorizar la alineación directa
        return distanciaPrincipal + (distanciaSecundaria * 2.2);
    }

    /**
     * Navegación optimizada para carruseles horizontales de Smart TV
     */
    function navegarCarruselHorizontal(elementoActual, direccion) {
        const carruselPista = elementoActual.closest('.fila-carrusel-pista');
        if (!carruselPista) return null;

        const tarjetas = Array.from(carruselPista.querySelectorAll('.tarjeta-contenido'));
        const indice = tarjetas.indexOf(elementoActual);
        if (indice === -1) return null;

        if (direccion === 'ArrowRight' && indice < tarjetas.length - 1) {
            return tarjetas[indice + 1];
        }

        if (direccion === 'ArrowLeft') {
            if (indice > 0) {
                return tarjetas[indice - 1];
            } else {
                // Al llegar al extremo izquierdo de la fila, saltar a la barra lateral de navegación
                const barra = document.querySelector('.barra-navegacion');
                if (barra) {
                    const tabActivo = barra.querySelector('.boton-navegacion.activo') || barra.querySelector('.boton-navegacion');
                    return tabActivo;
                }
            }
        }

        // Para Arriba y Abajo entre filas de carruseles
        if (direccion === 'ArrowDown' || direccion === 'ArrowUp') {
            const filas = Array.from(document.querySelectorAll('.fila-carrusel'));
            const filaActual = elementoActual.closest('.fila-carrusel');
            const indiceFila = filas.indexOf(filaActual);

            if (filaActual && indiceFila !== -1) {
                const filaDestino = direccion === 'ArrowDown' ? filas[indiceFila + 1] : filas[indiceFila - 1];
                if (filaDestino) {
                    const tarjetasFilaDestino = Array.from(filaDestino.querySelectorAll('.tarjeta-contenido'));
                    if (tarjetasFilaDestino.length > 0) {
                        // Encontrar la tarjeta con la posición X más cercana
                        const centroActualX = elementoActual.getBoundingClientRect().left + elementoActual.getBoundingClientRect().width / 2;
                        let mejorTarjeta = tarjetasFilaDestino[0];
                        let menorDiff = Infinity;

                        for (const tarjeta of tarjetasFilaDestino) {
                            const rectT = tarjeta.getBoundingClientRect();
                            const centroT = rectT.left + rectT.width / 2;
                            const diff = Math.abs(centroT - centroActualX);
                            if (diff < menorDiff) {
                                menorDiff = diff;
                                mejorTarjeta = tarjeta;
                            }
                        }
                        return mejorTarjeta;
                    }
                } else if (direccion === 'ArrowUp') {
                    // Si estamos en la primera fila y pulsamos arriba, ir a filtros o Hero
                    const heroBtn = document.querySelector('.boton-hero-primario');
                    if (heroBtn && !heroBtn.closest('.oculto')) return heroBtn;
                    const primerFiltro = document.querySelector('.pildora-filtro.activa') || document.querySelector('.pildora-filtro');
                    if (primerFiltro && !primerFiltro.closest('.oculto')) return primerFiltro;
                }
            }
        }

        return null;
    }

    /**
     * Manejador global de eventos de teclado / mando
     */
    function manejarKeyDown(evento) {
        // Soporte de tecla Atrás del mando
        if (esTeclaAtras(evento)) {
            if (typeof manejadorAtrasPersonalizado === 'function') {
                const consumido = manejadorAtrasPersonalizado();
                if (consumido) {
                    evento.preventDefault();
                    return;
                }
            }

            const modalActivo = obtenerModalActivo();
            if (modalActivo) {
                const botonCerrar = modalActivo.querySelector('[data-accion="cerrar"], .boton-cerrar-modal, .boton-volver-reproductor');
                if (botonCerrar) {
                    botonCerrar.click();
                } else {
                    modalActivo.classList.add('oculto');
                    if (elementoPrevioFoco) {
                        enfocarElemento(elementoPrevioFoco);
                    }
                }
                evento.preventDefault();
                return;
            }
        }

        // Navegación Direccional (D-Pad)
        if (TECLAS_DIRECCION.includes(evento.key)) {
            document.body.classList.add('modo-mando');

            const modalActivo = obtenerModalActivo();
            const ambito = modalActivo || document;
            const interactivos = obtenerElementosInteractivos(ambito);

            if (interactivos.length === 0) return;

            let actual = document.activeElement;
            if (!actual || actual === document.body || !interactivos.includes(actual)) {
                enfocarElemento(interactivos[0]);
                evento.preventDefault();
                return;
            }

            // 1. Probar navegación especializada en carruseles
            if (!modalActivo && actual.classList.contains('tarjeta-contenido')) {
                const siguienteEnCarrusel = navegarCarruselHorizontal(actual, evento.key);
                if (siguienteEnCarrusel) {
                    enfocarElemento(siguienteEnCarrusel);
                    evento.preventDefault();
                    return;
                }
            }

            // 2. Si estamos en la barra lateral y pulsamos derecha, saltar al contenido principal
            if (!modalActivo && actual.classList.contains('boton-navegacion') && evento.key === 'ArrowRight') {
                const heroBtn = document.querySelector('.boton-hero-primario');
                if (heroBtn && !heroBtn.closest('.oculto')) {
                    enfocarElemento(heroBtn);
                    evento.preventDefault();
                    return;
                }
                const primeraTarjeta = document.querySelector('.fila-carrusel .tarjeta-contenido, .rejilla-contenido .tarjeta-contenido');
                if (primeraTarjeta) {
                    enfocarElemento(primeraTarjeta);
                    evento.preventDefault();
                    return;
                }
            }

            // 3. Algoritmo de navegación espacial bidimensional estándar
            const rectActual = actual.getBoundingClientRect();
            let mejorCandidato = null;
            let mejorPuntuacion = Infinity;

            for (const candidato of interactivos) {
                if (candidato === actual) continue;
                const rectCandidato = candidato.getBoundingClientRect();
                const puntuacion = calcularPuntuacionDireccional(rectActual, rectCandidato, evento.key);

                if (puntuacion < mejorPuntuacion) {
                    mejorPuntuacion = puntuacion;
                    mejorCandidato = candidato;
                }
            }

            if (mejorCandidato) {
                enfocarElemento(mejorCandidato);
                evento.preventDefault();
            }
        }

        // Selección con Enter / OK
        if (TECLAS_SELECCION.includes(evento.key)) {
            const actual = document.activeElement;
            if (actual && actual !== document.body && typeof actual.click === 'function') {
                // El navegador ejecuta el click por defecto en botones, pero forzamos en tarjetas
                if (actual.classList.contains('tarjeta-contenido')) {
                    actual.click();
                    evento.preventDefault();
                }
            }
        }
    }

    function desactivarModoMando() {
        if (document.body.classList.contains('modo-mando')) {
            document.body.classList.remove('modo-mando');
            document.querySelectorAll('.foco-activo').forEach(el => el.classList.remove('foco-activo'));
        }
        // Retirar el foco activo para evitar halos en ratón y pantallas táctiles
        if (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            document.activeElement.blur();
        }
    }

    /**
     * Inicializa los listeners globales de navegación
     */
    function inicializar() {
        window.addEventListener('keydown', manejarKeyDown);

        // Desactivar el cursor visual de flechas cuando se usa ratón o móvil
        window.addEventListener('mousemove', desactivarModoMando, { passive: true });
        window.addEventListener('mousedown', desactivarModoMando, { passive: true });
        window.addEventListener('touchstart', desactivarModoMando, { passive: true });
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' || e.pointerType === 'touch') {
                desactivarModoMando();
            }
        }, { passive: true });

        // Si se usa mando a distancia, mantener clase de foco sincronizada
        document.addEventListener('focusin', (e) => {
            if (document.body.classList.contains('modo-mando') && e.target && e.target !== document.body) {
                document.querySelectorAll('.foco-activo').forEach(el => el.classList.remove('foco-activo'));
                e.target.classList.add('foco-activo');
            }
        });
    }

    function registrarManejadorAtras(fn) {
        manejadorAtrasPersonalizado = fn;
    }

    function desregistrarManejadorAtras() {
        manejadorAtrasPersonalizado = null;
    }

    return {
        inicializar,
        enfocarElemento,
        obtenerElementosInteractivos,
        registrarManejadorAtras,
        desregistrarManejadorAtras
    };
})();

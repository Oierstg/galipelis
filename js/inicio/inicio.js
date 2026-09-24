/**
 * Lógica de la Vista de Catálogo (inicio.js) — Alto Rendimiento para Smart TV
 * Directrices: /home/oierst/.gemini/GEMINI.md
 */

(() => {
    'use strict';

    const BASE_PROXY = typeof Utilidades !== 'undefined' && Utilidades.obtenerUrlBackend ? Utilidades.obtenerUrlBackend() : window.location.origin;
    const MAX_TARJETAS_POR_FILA = 28;
    const MAX_FILAS_INICIALES = 12;

    /* ── Estado Global ── */
    let usuarioActual = null;
    let usuarioEsAdmin = false;
    let favoritosUsuario = [];
    let progresoUsuario = {};

    /* Índices de Alto Rendimiento (Agrupados previamente) */
    const catalogo = {
        'Live TV': { grupos: {}, listaGrupos: [], itemsTotal: 0 },
        'Movies':  { grupos: {}, listaGrupos: [], itemsTotal: 0 },
        'Series':  { series: {}, grupos: {}, listaGrupos: [], itemsTotal: 0 }
    };

    let categoriaActual = 'Live TV';
    let subcategoriaActual = 'all';

    /* ── Elementos DOM ── */
    let barraNav, botonesNav, entradaBusqueda, botonLimpiarBusqueda;
    let tituloVistaActual, textoEmisionesActivas, nombreUsuario, avatarIniciales;
    let envoltorioCarga, seccionDestacada, fondoDestacado, tituloDestacado, descripcionDestacado;
    let botonHeroReproducir, pistaFiltros, contenedorCarruseles, rejillaContenido;

    /* Modales */
    let modalLogin, formLogin, campoUsuario, campoClave, alertaErrorLogin, botonCerrarSesion;
    let modalDetalle, btnCerrarDetalle, imgPortadaDetalle, tituloDetalle, ratingDetalle, anoDetalle;
    let duracionDetalle, generoDetalle, valorDirectorDetalle, valorRepartoDetalle, sinopsisDetalle, btnPlayDetalle;
    let modalSeries, btnCerrarSeries, imgPortadaSeries, tituloModalSeries, selectorTemporadas, listaEpisodios;

    /* ── Inicialización ── */
    document.addEventListener('DOMContentLoaded', () => {
        vincularElementosDOM();
        vincularEventosUI();
        NavegacionMando.inicializar();
        verificarSesionUsuario();
    });

    function vincularElementosDOM() {
        barraNav               = document.getElementById('barra-navegacion');
        botonesNav             = document.querySelectorAll('.boton-navegacion[data-seccion]');
        entradaBusqueda        = document.getElementById('entrada-busqueda');
        botonLimpiarBusqueda   = document.getElementById('boton-limpiar-busqueda');
        tituloVistaActual      = document.getElementById('titulo-vista-actual');
        textoEmisionesActivas  = document.getElementById('texto-emisiones-activas');
        nombreUsuario          = document.getElementById('nombre-usuario');
        avatarIniciales        = document.getElementById('avatar-iniciales');
        envoltorioCarga        = document.getElementById('envoltorio-carga');
        seccionDestacada       = document.getElementById('seccion-destacada');
        fondoDestacado         = document.getElementById('fondo-destacado');
        tituloDestacado        = document.getElementById('titulo-destacado');
        descripcionDestacado   = document.getElementById('descripcion-destacado');
        botonHeroReproducir    = document.getElementById('boton-hero-reproducir');
        pistaFiltros           = document.getElementById('pista-filtros');
        contenedorCarruseles   = document.getElementById('contenedor-carruseles');
        rejillaContenido       = document.getElementById('rejilla-contenido');

        modalLogin             = document.getElementById('modal-inicio-sesion');
        formLogin              = document.getElementById('formulario-login');
        campoUsuario           = document.getElementById('campo-usuario');
        campoClave             = document.getElementById('campo-clave');
        alertaErrorLogin       = document.getElementById('alerta-error-login');
        botonCerrarSesion      = document.getElementById('boton-cerrar-sesion');

        modalDetalle           = document.getElementById('modal-detalle-contenido');
        btnCerrarDetalle       = document.getElementById('boton-cerrar-detalle');
        imgPortadaDetalle      = document.getElementById('imagen-portada-detalle');
        tituloDetalle          = document.getElementById('titulo-detalle-contenido');
        ratingDetalle          = document.getElementById('etiqueta-puntuacion-detalle');
        anoDetalle             = document.getElementById('etiqueta-ano-detalle');
        duracionDetalle        = document.getElementById('etiqueta-duracion-detalle');
        generoDetalle          = document.getElementById('etiqueta-genero-detalle');
        valorDirectorDetalle   = document.getElementById('valor-director-detalle');
        valorRepartoDetalle    = document.getElementById('valor-reparto-detalle');
        sinopsisDetalle        = document.getElementById('texto-sinopsis-detalle');
        btnPlayDetalle         = document.getElementById('boton-reproducir-detalle');

        modalSeries            = document.getElementById('modal-series');
        btnCerrarSeries        = document.getElementById('boton-cerrar-series');
        imgPortadaSeries       = document.getElementById('imagen-portada-series');
        tituloModalSeries      = document.getElementById('titulo-modal-series');
        selectorTemporadas     = document.getElementById('selector-temporadas');
        listaEpisodios         = document.getElementById('lista-episodios');
    }

    function vincularEventosUI() {
        // Navegación lateral entre secciones
        botonesNav.forEach(btn => {
            btn.addEventListener('click', () => {
                const seccion = btn.getAttribute('data-seccion');
                if (seccion === 'buscar') {
                    entradaBusqueda.focus();
                } else {
                    cambiarSeccion(seccion);
                }
            });
        });

        // Búsqueda instantánea con debounce
        entradaBusqueda.addEventListener('input', Utilidades.debounce((e) => {
            const consulta = e.target.value.trim();
            if (consulta.length > 0) {
                botonLimpiarBusqueda.classList.remove('oculto');
                ejecutarBusqueda(consulta);
            } else {
                botonLimpiarBusqueda.classList.add('oculto');
                mostrarSeccionActual();
            }
        }, 200));

        botonLimpiarBusqueda.addEventListener('click', () => {
            entradaBusqueda.value = '';
            botonLimpiarBusqueda.classList.add('oculto');
            mostrarSeccionActual();
            entradaBusqueda.focus();
        });

        // Cierre de sesión y modales
        botonCerrarSesion.addEventListener('click', cerrarSesion);
        formLogin.addEventListener('submit', manejarEnvioLogin);
        btnCerrarDetalle.addEventListener('click', () => modalDetalle.classList.add('oculto'));
        btnCerrarSeries.addEventListener('click', () => modalSeries.classList.add('oculto'));

        selectorTemporadas.addEventListener('change', (e) => {
            renderizarEpisodios(e.target.value);
        });
    }

    /* ── Autenticación de Usuario basada en Tokens Backend ── */
    async function verificarSesionUsuario() {
        const token = Utilidades.obtenerToken();

        if (token) {
            try {
                const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/auth/me`);
                if (res.ok) {
                    const datos = await res.json();
                    if (datos.authenticated && datos.username) {
                        usuarioActual = datos.username;
                        usuarioEsAdmin = Boolean(datos.is_admin);
                        alAutenticarUsuario();
                        return;
                    }
                }
            } catch (err) {
                console.warn('[GaliPTV] Error validando sesión en backend:', err);
            }
        }

        // Si el token es inválido o no existe, limpiar y requerir inicio de sesión
        Utilidades.eliminarToken();
        modalLogin.classList.remove('oculto');
        campoUsuario.focus();
    }

    async function manejarEnvioLogin(e) {
        e.preventDefault();
        alertaErrorLogin.classList.add('oculto');
        const u = campoUsuario.value.trim();
        const p = campoClave.value.trim();

        if (!u || !p) {
            alertaErrorLogin.textContent = 'Introduce usuario y contraseña';
            alertaErrorLogin.classList.remove('oculto');
            return;
        }

        try {
            const res = await fetch(`${BASE_PROXY}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            const datos = await res.json();
            if (res.ok && datos.success && datos.token) {
                Utilidades.guardarToken(datos.token);
                usuarioActual = datos.username;
                usuarioEsAdmin = Boolean(datos.is_admin);
                modalLogin.classList.add('oculto');
                campoClave.value = '';
                alAutenticarUsuario();
            } else {
                alertaErrorLogin.textContent = datos.error || 'Credenciales incorrectas';
                alertaErrorLogin.classList.remove('oculto');
            }
        } catch (err) {
            alertaErrorLogin.textContent = 'Error de conexión con el servidor';
            alertaErrorLogin.classList.remove('oculto');
        }
    }

    function alAutenticarUsuario() {
        nombreUsuario.textContent = usuarioActual;
        avatarIniciales.textContent = usuarioActual.charAt(0).toUpperCase();

        cargarDatosUsuario();
        iniciarContadorEmisiones();
        cargarListaCanales();
    }

    async function cerrarSesion() {
        try {
            await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {}
        Utilidades.eliminarToken();
        sessionStorage.removeItem('gali_m3u_cache');
        window.location.reload();
    }

    async function cargarDatosUsuario() {
        if (!usuarioActual) return;
        try {
            const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/api/user/data`);
            if (res.status === 401) {
                cerrarSesion();
                return;
            }
            if (res.ok) {
                const datos = await res.json();
                favoritosUsuario = datos.favorites || [];
                progresoUsuario = datos.progress || {};
            }
        } catch (err) {
            console.warn('[GaliPTV] Error al cargar datos de usuario:', err);
        }
    }

    function iniciarContadorEmisiones() {
        try {
            const urlEventos = Utilidades.adjuntarTokenAUrl(`${BASE_PROXY}/api/stats/events`);
            const evtSource = new EventSource(urlEventos);
            evtSource.onmessage = (e) => {
                try {
                    const d = JSON.parse(e.data);
                    if (typeof d.active_count === 'number') {
                        textoEmisionesActivas.textContent = `${d.active_count}/2 activas`;
                    }
                } catch (err) {}
            };
        } catch (err) {}
    }

    /* ── Carga y Pre-indexación Ultrarrápida de la Lista M3U ── */
    const REGEX_ADULTOS = /(?:\+18|18\+|adultos?|xxx+|playboy|venus|erotici?a?|porno?|brazzers|hentai|\bsexo?\b)/i;
    const REGEX_LOGO = /tvg-logo="([^"]+)"/;
    const REGEX_GRUPO = /group-title="([^"]+)"/;
    const REGEX_SERIE = /^(.*?)\s*(?:S(\d{1,2})\s*E(\d{1,3})|T(\d{1,2})\s*C(\d{1,3}))/i;

    async function cargarListaCanales() {
        envoltorioCarga.classList.remove('oculto');
        seccionDestacada.classList.add('oculto');
        contenedorCarruseles.classList.add('oculto');
        rejillaContenido.classList.add('oculto');

        let textoM3U = sessionStorage.getItem('gali_m3u_cache');
        if (!textoM3U) {
            try {
                const res = await Utilidades.peticionAutenticada(`${BASE_PROXY}/playlist.m3u`);
                if (res.status === 401) {
                    cerrarSesion();
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                textoM3U = await res.text();
                try { sessionStorage.setItem('gali_m3u_cache', textoM3U); } catch (e) {}
            } catch (err) {
                console.error('[GaliPTV] Error al descargar playlist.m3u:', err);
                envoltorioCarga.querySelector('.texto-carga').textContent = 'Error al cargar la lista de canales.';
                return;
            }
        }

        // Procesar en una única pasada rápida
        preindexarM3U(textoM3U);
        envoltorioCarga.classList.add('oculto');
        mostrarSeccionActual();
    }

    function preindexarM3U(contenido) {
        // Reiniciar estructuras
        catalogo['Live TV'] = { grupos: {}, listaGrupos: [], itemsTotal: 0 };
        catalogo['Movies']  = { grupos: {}, listaGrupos: [], itemsTotal: 0 };
        catalogo['Series']  = { series: {}, grupos: {}, listaGrupos: [], itemsTotal: 0 };

        const lineas = contenido.split('\n');
        let actual = null;

        for (let i = 0, len = lineas.length; i < len; i++) {
            const linea = lineas[i].trim();
            if (linea.charCodeAt(0) === 35 /* '#' */ && linea.startsWith('#EXTINF:')) {
                const matchLogo = REGEX_LOGO.exec(linea);
                const matchGrupo = REGEX_GRUPO.exec(linea);
                const idxComa = linea.lastIndexOf(',');
                const nombre = idxComa !== -1 ? linea.substring(idxComa + 1).trim() : linea;
                const grupo = matchGrupo ? matchGrupo[1] : 'General';

                if (REGEX_ADULTOS.test(`${nombre} ${grupo}`)) {
                    actual = null;
                    continue;
                }

                let cat = 'Live TV';
                const gBaja = grupo.toLowerCase();
                if (gBaja.includes('vod') || gBaja.includes('pelicula') || gBaja.includes('cine') || gBaja.includes('movie')) {
                    cat = 'Movies';
                } else if (gBaja.includes('serie') || gBaja.includes('temporada')) {
                    cat = 'Series';
                }

                actual = {
                    name: nombre,
                    logo: matchLogo ? matchLogo[1] : null,
                    group: grupo,
                    category: cat
                };
            } else if (actual && linea.charCodeAt(0) === 104 /* 'h' */ && linea.startsWith('http')) {
                actual.url = linea;
                if (actual.category === 'Live TV' && (linea.includes('.mp4') || linea.includes('.mkv'))) {
                    actual.category = 'Movies';
                }

                const cat = actual.category;
                const grp = actual.group || 'General';

                if (cat === 'Series') {
                    // Agrupar serie por nombre
                    const m = REGEX_SERIE.exec(actual.name);
                    let sNombre = actual.name, sTemp = 1, sEp = 1;
                    if (m) {
                        sNombre = m[1].trim();
                        sTemp = parseInt(m[2] || m[4]);
                        sEp = parseInt(m[3] || m[5]);
                    }

                    if (!catalogo.Series.series[sNombre]) {
                        catalogo.Series.series[sNombre] = {
                            name: sNombre,
                            cover: actual.logo,
                            group: grp,
                            category: 'Series',
                            seasons: {}
                        };
                        // Añadir a grupo de series para mostrar en carrusel
                        if (!catalogo.Series.grupos[grp]) {
                            catalogo.Series.grupos[grp] = [];
                        }
                        catalogo.Series.grupos[grp].push(catalogo.Series.series[sNombre]);
                    }

                    if (!catalogo.Series.series[sNombre].seasons[sTemp]) {
                        catalogo.Series.series[sNombre].seasons[sTemp] = [];
                    }
                    catalogo.Series.series[sNombre].seasons[sTemp].push({ ...actual, episode: sEp });
                    if (!catalogo.Series.series[sNombre].cover && actual.logo) {
                        catalogo.Series.series[sNombre].cover = actual.logo;
                    }
                    catalogo.Series.itemsTotal++;
                } else {
                    // Live TV o Películas: indexar directamente por grupo
                    if (!catalogo[cat].grupos[grp]) {
                        catalogo[cat].grupos[grp] = [];
                    }
                    catalogo[cat].grupos[grp].push(actual);
                    catalogo[cat].itemsTotal++;
                }

                actual = null;
            }
        }

        // Ordenar listas de grupos con prioridad España / TDT
        for (const cat of ['Live TV', 'Movies', 'Series']) {
            catalogo[cat].listaGrupos = ordenarGruposEspanaPrimero(Object.keys(catalogo[cat].grupos));
        }
    }

    function ordenarGruposEspanaPrimero(grupos) {
        return grupos.sort((a, b) => {
            const aEsEsp = /spain|españa|tdt|movistar|dazn/i.test(a);
            const bEsEsp = /spain|españa|tdt|movistar|dazn/i.test(b);
            if (aEsEsp && !bEsEsp) return -1;
            if (!aEsEsp && bEsEsp) return 1;
            return a.localeCompare(b);
        });
    }

    /* ── Renderizado Instantáneo de Secciones y Carruseles ── */
    function cambiarSeccion(seccion) {
        if (categoriaActual === seccion && subcategoriaActual === 'all') return;
        categoriaActual = seccion;
        subcategoriaActual = 'all';

        botonesNav.forEach(btn => {
            const activo = btn.getAttribute('data-seccion') === seccion;
            btn.classList.toggle('activo', activo);
        });

        const textosTitulo = {
            'Live TV': 'TV en Directo',
            'Movies': 'Películas',
            'Series': 'Series',
            'Favorites': 'Mis Favoritos'
        };
        tituloVistaActual.textContent = textosTitulo[seccion] || seccion;

        // Renderizado inmediato
        mostrarSeccionActual();
    }

    function mostrarSeccionActual() {
        rejillaContenido.classList.add('oculto');
        contenedorCarruseles.classList.remove('oculto');
        Utilidades.vaciarElemento(contenedorCarruseles);

        if (categoriaActual === 'Favorites') {
            renderizarFavoritos();
            return;
        }

        const datosCat = catalogo[categoriaActual];
        if (!datosCat || datosCat.listaGrupos.length === 0) {
            seccionDestacada.classList.add('oculto');
            contenedorCarruseles.innerHTML = '<div class="envoltorio-carga"><p class="texto-carga">No hay contenidos en esta sección.</p></div>';
            return;
        }

        // Renderizar barra de filtros / píldoras superior
        renderizarBarraFiltros(datosCat.listaGrupos);

        // Si se ha seleccionado un filtro de grupo específico, mostrar rejilla de ese grupo
        if (subcategoriaActual !== 'all') {
            mostrarRejillaGrupo(subcategoriaActual);
            return;
        }

        // Si "all", renderizar Hero banner con el primer elemento destacado
        const primerGrupo = datosCat.listaGrupos[0];
        const primerItem = datosCat.grupos[primerGrupo]?.[0];
        renderizarHeroBanner(primerItem);

        // Renderizar carruseles horizontales con límite de tarjetas por fila (alto rendimiento)
        const fragmento = document.createDocumentFragment();
        const gruposAMostrar = datosCat.listaGrupos.slice(0, MAX_FILAS_INICIALES);

        gruposAMostrar.forEach(grupo => {
            const itemsGrupo = datosCat.grupos[grupo];
            if (!itemsGrupo || itemsGrupo.length === 0) return;

            const fila = document.createElement('section');
            fila.className = 'fila-carrusel';
            fila.setAttribute('aria-label', grupo);

            const cabeceraFila = document.createElement('div');
            cabeceraFila.className = 'cabecera-carrusel';

            const tituloFila = document.createElement('h3');
            tituloFila.className = 'titulo-carrusel';
            tituloFila.textContent = grupo;

            const contadorFila = document.createElement('span');
            contadorFila.className = 'contador-carrusel';
            contadorFila.textContent = `${itemsGrupo.length} disponibles`;

            cabeceraFila.appendChild(tituloFila);
            cabeceraFila.appendChild(contadorFila);
            fila.appendChild(cabeceraFila);

            const pista = document.createElement('div');
            pista.className = 'fila-carrusel-pista sin-barra-desplazamiento';

            // Limitar a MAX_TARJETAS_POR_FILA para rendimiento de 60fps en TV
            const itemsCapped = itemsGrupo.slice(0, MAX_TARJETAS_POR_FILA);
            itemsCapped.forEach(item => {
                pista.appendChild(crearTarjeta(item));
            });

            fila.appendChild(pista);
            fragmento.appendChild(fila);
        });

        contenedorCarruseles.appendChild(fragmento);

        // Enfocar el primer elemento para Smart TV solo si se está en modo mando
        const primerElemento = contenedorCarruseles.querySelector('.tarjeta-contenido');
        if (primerElemento && document.body.classList.contains('modo-mando')) {
            NavegacionMando.enfocarElemento(primerElemento, false);
        }
    }

    function renderizarBarraFiltros(listaGrupos) {
        Utilidades.vaciarElemento(pistaFiltros);

        // Píldora "Todos los contenidos"
        const btnTodos = document.createElement('button');
        btnTodos.type = 'button';
        btnTodos.className = `pildora-filtro ${subcategoriaActual === 'all' ? 'activa' : ''}`;
        btnTodos.textContent = 'Todos';
        btnTodos.tabIndex = 0;
        btnTodos.addEventListener('click', () => {
            subcategoriaActual = 'all';
            mostrarSeccionActual();
        });
        pistaFiltros.appendChild(btnTodos);

        // Mostrar hasta 18 grupos más populares
        const gruposDestacados = listaGrupos.slice(0, 18);
        gruposDestacados.forEach(grupo => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `pildora-filtro ${subcategoriaActual === grupo ? 'activa' : ''}`;
            btn.textContent = grupo;
            btn.tabIndex = 0;

            btn.addEventListener('click', () => {
                subcategoriaActual = grupo;
                mostrarSeccionActual();
            });

            pistaFiltros.appendChild(btn);
        });
    }

    function mostrarRejillaGrupo(grupo) {
        seccionDestacada.classList.add('oculto');
        contenedorCarruseles.classList.add('oculto');
        rejillaContenido.classList.remove('oculto');
        Utilidades.vaciarElemento(rejillaContenido);

        const items = catalogo[categoriaActual]?.grupos[grupo] || [];
        if (items.length === 0) {
            rejillaContenido.innerHTML = '<div class="envoltorio-carga"><p class="texto-carga">No hay contenidos disponibles en este grupo.</p></div>';
            return;
        }

        const fragmento = document.createDocumentFragment();
        items.slice(0, 100).forEach(item => {
            fragmento.appendChild(crearTarjeta(item));
        });
        rejillaContenido.appendChild(fragmento);

        const primerEl = rejillaContenido.querySelector('.tarjeta-contenido');
        if (primerEl && document.body.classList.contains('modo-mando')) {
            NavegacionMando.enfocarElemento(primerEl, false);
        }
    }

    function renderizarFavoritos() {
        seccionDestacada.classList.add('oculto');
        Utilidades.vaciarElemento(pistaFiltros);

        const todosLosItems = [
            ...Object.values(catalogo['Live TV'].grupos).flat(),
            ...Object.values(catalogo['Movies'].grupos).flat(),
            ...Object.values(catalogo.Series.series)
        ];

        const favs = todosLosItems.filter(i => favoritosUsuario.includes(String(i.id || i.name)));

        if (favs.length === 0) {
            contenedorCarruseles.innerHTML = '<div class="envoltorio-carga"><p class="texto-carga">Aún no has añadido favoritos.</p><p class="subtexto-carga">Selecciona cualquier canal o película para guardarlo aquí.</p></div>';
            return;
        }

        rejillaContenido.classList.remove('oculto');
        contenedorCarruseles.classList.add('oculto');
        Utilidades.vaciarElemento(rejillaContenido);

        const fragmento = document.createDocumentFragment();
        favs.forEach(item => fragmento.appendChild(crearTarjeta(item)));
        rejillaContenido.appendChild(fragmento);

        const primerEl = rejillaContenido.querySelector('.tarjeta-contenido');
        if (primerEl && document.body.classList.contains('modo-mando')) {
            NavegacionMando.enfocarElemento(primerEl, false);
        }
    }

    function renderizarHeroBanner(item) {
        if (!item) {
            seccionDestacada.classList.add('oculto');
            return;
        }

        seccionDestacada.classList.remove('oculto');
        tituloDestacado.textContent = item.name;
        descripcionDestacado.textContent = item.group || 'Contenido disponible en GaliPTV';

        const imgUrl = Utilidades.obtenerUrlImagenSegura(item.logo || item.cover);
        if (imgUrl) {
            fondoDestacado.style.backgroundImage = `url("${imgUrl}")`;
        } else {
            fondoDestacado.style.backgroundImage = 'none';
        }

        const esCanal = categoriaActual === 'Live TV' || item.category === 'Live TV';
        botonHeroReproducir.onclick = () => {
            if (esCanal) {
                abrirReproductor(item);
            } else if (item.seasons) {
                abrirModalSeries(item);
            } else {
                abrirModalDetalle(item);
            }
        };
    }

    /* ── Creación de Tarjetas de Contenido (Smart TV) ── */
    function crearTarjeta(item) {
        const tarjeta = document.createElement('article');
        const esCanal = item.category === 'Live TV' || categoriaActual === 'Live TV';
        tarjeta.className = `tarjeta-contenido ${esCanal ? 'tipo-canal' : 'tipo-vertical'}`;
        tarjeta.tabIndex = 0;
        tarjeta.setAttribute('role', 'button');
        tarjeta.setAttribute('aria-label', item.name);

        const envoltorioImg = document.createElement('div');
        envoltorioImg.className = 'envoltorio-imagen-tarjeta';

        const img = document.createElement('img');
        img.className = 'imagen-tarjeta';
        img.alt = item.name;
        img.loading = 'lazy';
        img.src = Utilidades.obtenerUrlImagenSegura(item.logo || item.cover) || Utilidades.obtenerImagenRespaldo();
        img.onerror = () => { img.src = Utilidades.obtenerImagenRespaldo(); };
        envoltorioImg.appendChild(img);

        const insignia = document.createElement('span');
        insignia.className = 'etiqueta-flotante-tarjeta';
        insignia.textContent = esCanal ? 'EN DIRECTO' : (item.seasons ? 'SERIE' : 'PELÍCULA');
        envoltorioImg.appendChild(insignia);

        // Barra de progreso si ya se ha comenzado a ver
        const idItem = String(item.id || item.name);
        const prog = progresoUsuario[idItem];
        if (prog && prog.percentage > 0 && !prog.completed) {
            const barra = document.createElement('div');
            barra.className = 'barra-progreso-tarjeta';
            const relleno = document.createElement('div');
            relleno.className = 'relleno-progreso-tarjeta';
            relleno.style.width = `${prog.percentage}%`;
            barra.appendChild(relleno);
            envoltorioImg.appendChild(barra);
        }

        tarjeta.appendChild(envoltorioImg);

        const cuerpo = document.createElement('div');
        cuerpo.className = 'cuerpo-tarjeta';

        const titulo = document.createElement('h4');
        titulo.className = 'titulo-tarjeta';
        titulo.textContent = item.name;
        cuerpo.appendChild(titulo);

        const subtituloFila = document.createElement('div');
        subtituloFila.className = 'fila-subtitulo-tarjeta';

        const grupoTexto = document.createElement('span');
        grupoTexto.textContent = item.group || 'GaliPTV';
        subtituloFila.appendChild(grupoTexto);

        const ano = Utilidades.extraerAno(item.name);
        if (ano) {
            const anoTexto = document.createElement('span');
            anoTexto.textContent = ano;
            subtituloFila.appendChild(anoTexto);
        }

        cuerpo.appendChild(subtituloFila);
        tarjeta.appendChild(cuerpo);

        // Acción al pulsar
        tarjeta.addEventListener('click', () => {
            if (esCanal) {
                abrirReproductor(item);
            } else if (item.seasons) {
                abrirModalSeries(item);
            } else {
                abrirModalDetalle(item);
            }
        });

        return tarjeta;
    }

    /* ── Búsqueda ── */
    function ejecutarBusqueda(termino) {
        seccionDestacada.classList.add('oculto');
        contenedorCarruseles.classList.add('oculto');
        rejillaContenido.classList.remove('oculto');
        Utilidades.vaciarElemento(rejillaContenido);

        const terminoNorm = termino.toLowerCase();
        const resultados = [];

        // Buscar en canales, películas y series
        for (const cat of ['Live TV', 'Movies']) {
            for (const grp in catalogo[cat].grupos) {
                for (const item of catalogo[cat].grupos[grp]) {
                    if (item.name.toLowerCase().includes(terminoNorm)) {
                        resultados.push(item);
                        if (resultados.length >= 60) break;
                    }
                }
                if (resultados.length >= 60) break;
            }
            if (resultados.length >= 60) break;
        }

        if (resultados.length < 60) {
            for (const sNombre in catalogo.Series.series) {
                if (sNombre.toLowerCase().includes(terminoNorm)) {
                    resultados.push(catalogo.Series.series[sNombre]);
                    if (resultados.length >= 60) break;
                }
            }
        }

        if (resultados.length === 0) {
            rejillaContenido.innerHTML = '<div class="envoltorio-carga"><p class="texto-carga">No se encontraron resultados.</p></div>';
            return;
        }

        const fragmento = document.createDocumentFragment();
        resultados.forEach(item => fragmento.appendChild(crearTarjeta(item)));
        rejillaContenido.appendChild(fragmento);
    }

    /* ── Modales de Información ── */
    async function abrirModalDetalle(item) {
        modalDetalle.classList.remove('oculto');
        tituloDetalle.textContent = item.name;
        imgPortadaDetalle.src = Utilidades.obtenerUrlImagenSegura(item.logo || item.cover) || Utilidades.obtenerImagenRespaldo();
        sinopsisDetalle.textContent = 'Cargando sinopsis y detalles...';

        const ano = Utilidades.extraerAno(item.name) || '2024';
        anoDetalle.textContent = ano;
        ratingDetalle.textContent = '-- / 10';
        duracionDetalle.textContent = '-- min';
        generoDetalle.textContent = 'Cine / Película';
        valorDirectorDetalle.textContent = '--';
        valorRepartoDetalle.textContent = '--';

        btnPlayDetalle.onclick = () => {
            modalDetalle.classList.add('oculto');
            abrirReproductor(item);
        };

        NavegacionMando.enfocarElemento(btnPlayDetalle);

        try {
            const res = await fetch(`${BASE_PROXY}/omdb?title=${encodeURIComponent(item.name)}&year=${ano}`);
            if (res.ok) {
                const data = await res.json();
                if (data.Response === 'True') {
                    if (data.Plot && data.Plot !== 'N/A') sinopsisDetalle.textContent = data.Plot;
                    if (data.imdbRating && data.imdbRating !== 'N/A') ratingDetalle.textContent = `${data.imdbRating} / 10`;
                    if (data.Runtime && data.Runtime !== 'N/A') duracionDetalle.textContent = data.Runtime;
                    if (data.Genre && data.Genre !== 'N/A') generoDetalle.textContent = data.Genre;
                    if (data.Director && data.Director !== 'N/A') valorDirectorDetalle.textContent = data.Director;
                    if (data.Actors && data.Actors !== 'N/A') valorRepartoDetalle.textContent = data.Actors;
                }
            }
        } catch (e) {}
    }

    function abrirModalSeries(serie) {
        modalSeries.classList.remove('oculto');
        tituloModalSeries.textContent = serie.name;
        imgPortadaSeries.src = Utilidades.obtenerUrlImagenSegura(serie.cover) || Utilidades.obtenerImagenRespaldo();

        Utilidades.vaciarElemento(selectorTemporadas);
        const temporadas = Object.keys(serie.seasons).sort((a, b) => parseInt(a) - parseInt(b));

        temporadas.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = `Temporada ${t}`;
            selectorTemporadas.appendChild(opt);
        });

        selectorTemporadas.serieActual = serie;
        renderizarEpisodios(temporadas[0]);
        NavegacionMando.enfocarElemento(selectorTemporadas);
    }

    function renderizarEpisodios(numTemporada) {
        const serie = selectorTemporadas.serieActual;
        if (!serie) return;

        Utilidades.vaciarElemento(listaEpisodios);
        const episodios = serie.seasons[numTemporada] || [];

        episodios.forEach(ep => {
            const row = document.createElement('div');
            row.className = 'item-episodio';
            row.tabIndex = 0;

            const izq = document.createElement('div');
            izq.className = 'info-episodio-izq';

            const num = document.createElement('span');
            num.className = 'numero-episodio';
            num.textContent = `Ep. ${ep.episode}`;
            izq.appendChild(num);

            const nom = document.createElement('span');
            nom.className = 'nombre-episodio';
            nom.textContent = ep.name;
            izq.appendChild(nom);

            row.appendChild(izq);

            row.addEventListener('click', () => {
                modalSeries.classList.add('oculto');
                abrirReproductor(ep);
            });

            listaEpisodios.appendChild(row);
        });
    }

    /* ── Navegación al Reproductor Independiente ── */
    function abrirReproductor(item) {
        const token = Utilidades.obtenerToken();
        const paramsObj = {
            url: item.url || '',
            nombre: item.name || '',
            grupo: item.group || 'GaliPTV',
            tipo: item.category || categoriaActual,
            id: String(item.id || item.name)
        };
        if (token) {
            paramsObj.token = token;
        }
        const urlParams = new URLSearchParams(paramsObj);
        window.location.href = `../reproductor/reproductor.html?${urlParams.toString()}`;
    }

})();

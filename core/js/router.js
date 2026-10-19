/* Núcleo · rotas hash locais, sem fetch nem módulos ES. */
(function (C) {
  'use strict';

  C.Router = {
    register(path, title, render, group = 'Operações') {
      C.routes[path] = {
        title,
        render,
        group
      };
    },
    go(path) {
      location.hash = path;
    },
    current() {
      const [path, query = ''] = location.hash.slice(1).split('?');
      return {
        path: path || 'inicio',
        params: new URLSearchParams(query)
      };
    },
    render() {
      C.UI.render();
    }
  };
  addEventListener('hashchange', () => {
    C.Router.render();
    window.scrollTo(0, 0);
  });
})(Cesbank);

requirejs.config({
  paths: {
    jQuery: 'https://code.jquery.com/jquery-3.1.0.js',
    lodash: 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.15.0/lodash.js',
    q: 'https://cdnjs.cloudflare.com/ajax/libs/q.js/2.0.3/q.js',
  }
});

requirejs(['scripts/index']);

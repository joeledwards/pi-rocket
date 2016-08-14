$(document).ready(() => {
  $('#launch-button').bind('click', () => launch);
});

function ignition(state) {
  let d = Q.defer();
  
  $.get(state)
  .done((data) => {
    console.log('done:', data);
    d.resolve():
  })
  .fail((error) => {
    console.error('fail:', error);
    d.reject(error):
  });

  return d.promise;
}

function ignitionOn() {
  return ignition('/on');
}

function ignitionOff() {
  return ignition('/off');
}

function launch() {
  ignitionOn()
  .then(() => {
    setTimeout(ignitionOff, 5000);
  })
  .catch((error) => {
    console.error('Ignition error:', error);
  });
}

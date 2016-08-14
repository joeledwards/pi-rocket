require(['jQuery', 'lodash', 'q'], ($, _, Q) => {
  // Set the ignition state (on/off)
  const ignition = (state) => {
    let d = Q.defer();
    
    $.get(state)
    .done((data) => {
      console.log('done:', data);
      d.resolve();
    })
    .fail((error) => {
      console.error('fail:', error);
      d.reject(error);
    });

    return d.promise;
  };

  // Turn ignition on
  const ignitionOn = () => {
    return ignition('/on');
  };

  // Turn ignition off
  const ignitionOff = () => {
    return ignition('/off');
  };

  // Launch the rocket (ignition on for 5 seconds, then off)
  const launch = () => {
    ignitionOn()
    .then(() => {
      setTimeout(ignitionOff, 5000);
    })
    .catch((error) => {
      console.error('Ignition error:', error);
    });
  };

  // Set up jQuery bindings
  $(document).ready(() => {
    $('#launch-button').bind('click', () => launch);
  });
});


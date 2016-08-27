// Set the ignition state (on/off)
const ignition = (state) => {
  return new Promise((resolve, reject) => {
    $.post(state)
    .done((data) => {
      console.log('done:', data);
      resolve();
    })
    .fail((error) => {
      console.error('fail:', error);
      reject(error);
    });
  });
};

// Turn ignition on
const ignitionOn = () => {
  console.log('Ignition on.');

  return ignition('/on');
};

// Turn ignition off
const ignitionOff = () => {
  console.log('Ignition off.');

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
  $('#launch-button').bind('click', launch);
});


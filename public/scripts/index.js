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
  console.log('Ignition on.', JSON.stringify(autoClears));
  return ignition('/on');
};

// Turn ignition off
const ignitionOff = () => {
  console.log('Ignition off.', JSON.stringify(autoClears));
  flushAutoClears();
  return ignition('/off');
};

const flushAutoClears = () => {
  autoClears.forEach(ac => ac.cancel = true);
  autoClears = [];
}

let autoClears = [];

// Launch the rocket (ignition on for 5 seconds, then off)
const launch = () => {
  ignitionOn()
  .then(() => {
    let autoClear = {id: new Date().getTime(), cancel: false};
    autoClears.push(autoClear);
    setTimeout(() => {
      if (autoClear.cancel !== true) {
        ignitionOff();
      }
    }, 5000)
  })
  .catch((error) => {
    console.error('Ignition error:', error);
  });
};

// Set up jQuery bindings
$(document).ready(() => {
  $('#launch-button').bind('click', launch);
  $('#clear-button').bind('click', ignitionOff);
});


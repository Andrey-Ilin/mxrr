console.clear();

const fileUrls = [
  '../mxrr/audio_files/Bedtime_1.mp3',
  '../mxrr/audio_files/Bedtime_2.mp3',
  '../mxrr/audio_files/Bedtime_3.mp3',
  '../mxrr/audio_files/Bedtime_4.mp3',
  '../mxrr/audio_files/Bedtime_5.mp3',
  '../mxrr/audio_files/Bedtime_6.mp3',
  // '../audio_files/Bedtime_7.mp3',
  // '../audio_files/Bedtime_8.mp3',
  // '../audio_files/Bedtime_9.mp3',
  // '../audio_files/Bedtime_10.mp3',
  // '../audio_files/Bedtime_1.mp3',
  // '../audio_files/Bedtime_2.mp3',
  // '../audio_files/Bedtime_3.mp3',
];

// for cross browser compatibility
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioContext = new AudioContext();

//
let samplesBuffersNodes = [];
let effectGainNodes = [];
let durations = [];
let solos = [];
let offset = 0;
let timeForView = 0;
let startedAt;
let interval;

// Seek control
const seekControl = document.getElementById('seek');
seekControl.addEventListener('input', function (e) {
  console.log('INPUT');
});

seekControl.addEventListener('change', function (e) {
  const seekVal = +this.value;
  offset = seekVal;
  stopAll();
  playAllHandler(seekVal);
  playAll.innerText = 'Pause';
});

// Play control
const playAll = document.getElementById('playAll');
playAll.addEventListener('click', function () {
  if (playAll.innerText === 'Play') {
    playAllHandler(offset);
    playAll.innerText = 'Pause';
  } else {
    stopAll();
    playAll.innerText = 'Play';
  }
});

// AudioBuffers collection
const buffers = new Map();

loadChannels(fileUrls);

// Utils
function loadChannels(files) {
  files.forEach((f, i) => {
    const nameArr = f.split('/');
    const name = nameArr[nameArr.length - 1];
    effectGainNodes.push(appendChannel(i, name));
    const start = new Date().getTime();
    fetch(f)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => {
        if (audioContext.decodeAudioData.length === 2) { // Safari
          return new Promise(resolve => {
            audioContext.decodeAudioData(arrayBuffer, buffer => {
              resolve(buffer);
            });
          });
        } else {
          return audioContext.decodeAudioData(arrayBuffer);
        }
      })
      .then(audioBuffer => {
        // draw(normalizeData(filterData(audioBuffer)), `wave-${i}`);
        buffers.set(i, audioBuffer);
        document.getElementById(`loaded-time-${i}`)
          .innerText = `Time: ${(new Date().getTime() - start) / 1000} sec`;
        document.getElementsByClassName(`play-controls-${i}`)[0]
          .style.background = 'rgba(10, 128, 10, 0.3)';

        if (buffers.size === files.length) {
          playAll.removeAttribute('disabled');
          seekControl.removeAttribute('disabled');
          buffers.forEach((a) => {
            durations.push(a.duration);
          });
          seekControl.setAttribute('max', durations.reduce(function(a, b) {
            return Math.max(a, b);
          }));
        }
        console.log(buffers)
      })
      .catch(e => console.log('error: ', e));
  });
}

function appendChannel(index, name) {
  const div = document.createElement('div');
  div.className = `channel channel-${index}`;
  div.innerHTML = `
    <div class="play-controls play-controls-${index}">
        <p>${name}</p>
        <div id="loaded-time-${index}" class="loaded-time"></div>
        <div class="mute-solo">
            <button  id="mute-${index}">Mute</button>
            <button  id="solo-${index}">Solo</button>
        </div>
        <div class="range-control">
            <label>VOL</label>
            <input type="range" id="volume-${index}" class="control-volume" min="0" max="2" value="1" list="gain-vals-${index}" step="0.01" data-action="volume" />
            <datalist id="gain-vals-${index}">
                <option value="0" label="min"></option>
                <option value="2" label="max"></option>
            </datalist>
        </div>
        <div class="range-control">
            <label>PAN</label>
            <input type="range" id="panner-${index}" class="control-panner" list="pan-vals-${index}" min="-10" max="10" value="0" step="0.01" data-action="panner" />
            <datalist id="pan-vals-${index}">
                <option value="-1" label="left"></option>
                <option value="1" label="right"></option>
            </datalist>
        </div>
    </div>
    <div class="wave wave-${index}">
        <canvas id="wave-${index}"></canvas>
    </div>
   `;
  document.body.appendChild(div);
  const volumeControl = document.getElementById(`volume-${index}`);
  const muteControl = document.getElementById(`mute-${index}`);
  const soloControl = document.getElementById(`solo-${index}`);
  const pannerControl = document.getElementById(`panner-${index}`);

  const gainNode = audioContext.createGain();
  const panner = audioContext.createPanner();
  // const panner = audioContext.createPanner();
  // panner.panningModel = 'equalpower';

  volumeControl.addEventListener('input', function() {
    gainNode.gain.value = this.value;
    muteControl.innerText = 'Mute';
  }, false);

  pannerControl.addEventListener('input', function () {
    panner.setPosition(+this.value, 0, 0)
  });

  muteControl.addEventListener('click', function() {
    if (muteControl.innerText === 'Mute') {
      gainNode.gain.value = 0;
      muteControl.innerText = 'Unmute';
    } else {
      muteControl.innerText = 'Mute';
      gainNode.gain.value = volumeControl.value;
    }
  });

  soloControl.addEventListener('click', function () {
    setSoloByIndex(index);
  });

  return {
    gain: gainNode,
    panner: panner,
  };
}

function stopAll() {
  samplesBuffersNodes.forEach(function (sample) {
    sample.stop();
  });
  samplesBuffersNodes.length = 0;
  clearInterval(interval);
  startedAt = 0;
}

function playAllHandler(offset) {
  buffers.forEach(function(audioBuffer, key) {
    const sample = audioContext.createBufferSource();
    sample.buffer = audioBuffer;
    const gain = effectGainNodes[key].gain;
    const panner = effectGainNodes[key].panner;

    sample.connect(gain).connect(panner).connect(audioContext.destination);
    sample.start(0.5, offset || audioContext.currentTime);
    samplesBuffersNodes.push(sample);
  });

  startedAt = Date.now() - offset * 1000;

  interval = setInterval(() => {
    const playbackTime = (Date.now() - startedAt) / 1000;
    const time = formatTime(Math.floor(playbackTime));
    document.getElementById('progress').innerText = time;
    seekControl.value = playbackTime;
  },1000)
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h,
    m > 9 ? m : (h ? '0' + m : m || '0'),
    s > 9 ? s : '0' + s
  ].filter(Boolean).join(':');
}

function setSoloByIndex(index) {
    effectGainNodes.forEach(function (effect, i) {
      if (i !== index) {
        const muteControl = document.getElementById(`mute-${i}`);
        muteControl.innerText = 'Unmute';
        effect.gain.gain.value = 0;
      } else {
        const muteControl = document.getElementById(`mute-${i}`);
        const volumeControl = document.getElementById(`volume-${i}`);
        muteControl.innerText = 'Mute';
        effect.gain.gain.value = volumeControl.value;
      }
    })
}




function filterData(audioBuffer) {
  const rawData = audioBuffer.getChannelData(0); // We only need to work with one channel of data
  const samples = 261; // Number of samples we want to have in our final data set
  const blockSize = Math.floor(rawData.length / samples); // the number of samples in each subdivision
  const filteredData = [];
  for (let i = 0; i < samples; i++) {
    let blockStart = blockSize * i; // the location of the first sample in the block
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum = sum + Math.abs(rawData[blockStart + j]); // find the sum of all the samples in the block
    }
    filteredData.push(sum / blockSize); // divide the sum by the block size to get the average
  }
  return filteredData;
};

/**
 * Normalizes the audio data to make a cleaner illustration
 * @param {Array} filteredData the data from filterData()
 * @returns {Array} an normalized array of floating point numbers
 */
function normalizeData(filteredData) {
  const multiplier = Math.pow(Math.max(...filteredData), -1);
  return filteredData.map(n => n * multiplier);
};

/**
 * Draws the audio file into a canvas element.
 * @param {Array} normalizedData The filtered array returned from filterData()
 * @returns {Array} a normalized array of data
 */
function draw(normalizedData, selector) {
  // set up the canvas
  const canvas = document.getElementById(selector);
  const dpr = window.devicePixelRatio || 1;
  const padding = 20;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = (canvas.offsetHeight + padding * 2) * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.translate(0, canvas.offsetHeight / 2 + padding); // set Y = 0 to be in the middle of the canvas

  // draw the line segments
  const width = canvas.offsetWidth / normalizedData.length;
  for (let i = 0; i < normalizedData.length; i++) {
    const x = width * i;
    let height = normalizedData[i] * canvas.offsetHeight - padding;
    if (height < 0) {
      height = 0;
    } else if (height > canvas.offsetHeight / 2) {
      height = height > canvas.offsetHeight / 2;
    }
    drawLineSegment(ctx, x, height, width, (i + 1) % 2);
  }
};

/**
 * A utility function for drawing our line segments
 * @param {AudioContext} ctx the audio context
 * @param {number} x  the x coordinate of the beginning of the line segment
 * @param {number} height the desired height of the line segment
 * @param {number} width the desired width of the line segment
 * @param {boolean} isEven whether or not the segmented is even-numbered
 */
function drawLineSegment(ctx, x, height, width, isEven) {
  ctx.lineWidth = 1; // how thick the line is
  ctx.strokeStyle = "#fff"; // what color our line is
  ctx.beginPath();
  height = isEven ? 2*height : -2*height;
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.arc(x + width / 2, height, width / 2, Math.PI, 0, isEven);
  ctx.lineTo(x + width, 0);
  ctx.stroke();
};
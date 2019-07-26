/* 
* ECE462 - Computer Graphics Spring 2019
* Rubik's Cube Interaction
* Jongoh (Andy) Jeong 
* April 2, 2019
*/
"use strict";

// ---------define and store cube geometry---------
var vertices = new Int32Array([
    // each side has 4 vertices
    // when drawing triangles, pair up like (0,1,2), (0,2,3) => indices
    -1,-1,-1,    1,-1,-1,    1, 1,-1,   -1, 1,-1, // right
    -1,-1, 1,    1,-1, 1,    1, 1, 1,   -1, 1, 1, // left
    -1,-1,-1,   -1, 1,-1,   -1, 1, 1,   -1,-1, 1, // back
     1,-1,-1,    1, 1,-1,    1, 1, 1,    1,-1, 1, // front
    -1,-1,-1,   -1,-1, 1,    1,-1, 1,    1,-1,-1, // bottom
    -1, 1,-1,   -1, 1, 1,    1, 1, 1,    1, 1,-1, // top
  ]);

// Define Variables
var colors = {
  black: vec4(0.0, 0.0, 0.0, 1.0),
  white: vec4(1.0, 1.0, 1.0, 1.0),
  yellow: vec4(1.0, 1.0, 0.0, 1.0),
  orange: vec4(1.0, 0.5, 0.0, 1.0),
  red: vec4(1.0, 0.0, 0.0, 1.0),
  green: vec4(0.0, 1.0, 0.0, 1.0),
  blue: vec4(0.0, 0.0, 1.0, 1.0),
};

// for a surface with 4 vertices each, duplicate it over 4 indices
const surfaceColors = [
  colors["white"],  colors["white"],  colors["white"],  colors["white"], 
  colors["blue"],   colors["blue"],   colors["blue"],   colors["blue"], 
  colors["red"],    colors["red"],    colors["red"],    colors["red"],
  colors["yellow"], colors["yellow"], colors["yellow"], colors["yellow"],
  colors["green"],  colors["green"],  colors["green"],  colors["green"],
  colors["orange"], colors["orange"], colors["orange"], colors["orange"],
];

// indices  for triangular elements
var indices = [
    0, 1, 2,     0, 2, 3,    // bottom
    4, 5, 6,     4, 6, 7,    // top
    8, 9, 10,    8, 10, 11,  // left
    12, 13, 14,  12, 14, 15, // right
    16,17,18,    16,18,19,   // front
    20,21,22,    20,22,23    // back
];

// cube structure for each coordinate
var cube = [
    [ // x = -1
        [ // y = -1
            [],[],[] // z = -1, 0, 1
        ], 
        [ // y =  0
            [],[],[]  // z = -1, 0, 1
        ], 
        [ // y = +1
            [],[],[]  // z = -1, 0, 1
        ], 
    ], 
    [ // x =  0
        [ // y = -1
            [],[],[]  // z = -1, 0, 1
        ], 
        [ // y =  0
            [],[],[]  // z = -1, 0, 1
        ], 
        [ // y = +1
            [],[],[]  // z = -1, 0, 1
        ], 
    ], 
    [ // x = +1 
        [ // y = -1
            [],[],[]  // z = -1, 0, 1
        ], 
        [ // y =  0
            [],[],[]  // z = -1, 0, 1
        ],
        [ // y = +1
            [],[],[]  // z = -1, 0, 1
        ], 
    ],
    [], // theta
    [], // phi
];

// initial declarations for webgl program
var canvas;
var gl;
var program;

// assigning colors in render function at each frame
var cubeSideColors = [];

// Matrices for view
var u_projectionMatrix;
var u_modelViewMatrix;
var projMatrix = mat4(); // normalization matrix
var mvMatrix = mat4();   // modelview matrix

// theta = between x and y, phi = between xy-plane and z
// used for rotation and perspective
var THETA = radians(45);
var PHI = radians(45);

// initialization for lookAt()
var eye = vec3(1.0, 1.0, 0.0);  // position at which image is viewed from
var at = vec3(0.0, 0.0, 0.0);   // camera position (reference), in this case, the origin
var up = vec3(0.0, 1.0, 0.0);   // define which point is "up" of the camera

// initialization for perspective()
var field_of_view_vertical = 45.0;  // vertical angle of camera's lens; typical: 30~60 degrees
var aspect = 1.0;                   // width / height of canvas window
var near = 0.1;                     // far-near: smaller the better precision; typical: 0.1 / 100
var far = 100;
var cameraRadius = 30.0;

// Specify rotation state
var rotationAngle = 10;  // increments that add up to 90 degrees at the end
var baseRotationSpeed = 100;
var rotationSpeed = 100; // delay amount: 1 ms -- adjusted by rotation speed bar
var inRotation = false;
var currentAngle = 0;
var setIntervalTimerId;

// Queue for storing which faces to rotate in order
var cubeMoveQueue = [];

// buffers for shaders
var vertexBuffer;
var colorBuffer;
var indexBuffer;

// attributes in vertex-shader
var a_color;
var a_position;

// file management variables
var loadedFile;
var fileLoaded = false;

// scramble
var scrambleValue = 0;

window.onload = function init() {
  if (window.File && window.FileReader && window.FileList && window.Blob) {
  console.log("This is working");
  }else {
  console.log("Not all the file APIs are supported!");
  }

  // Creating a canvas
  canvas = document.getElementById("gl-canvas");
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    alert("WebGL isn't available");
  }
  // adjust pixel resolution by system platform
  var devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.75, 0.85, 0.8, 1.0); // aliceblue background fill
  gl.enable(gl.DEPTH_TEST);

  // Load shaders and initialize attribute buffers
  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  // show program attributes in console
  var numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (var ii = 0; ii < numAttribs; ++ii) {
    var attribInfo = gl.getActiveAttrib(program, ii);
    if (!attribInfo) {
      break;
    }
    console.log(gl.getAttribLocation(program, attribInfo.name), attribInfo.name);
  }

  // Array element buffer
  indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indices), gl.STATIC_DRAW);

  // Color array attribute buffer
  colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(cubeSideColors), gl.STATIC_DRAW);

  a_color = gl.getAttribLocation(program, "color");
  gl.vertexAttribPointer(a_color, 4, gl.FLOAT, false, 0 , 0);
  gl.enableVertexAttribArray(a_color); 

  // Vertex array attribute buffer
  vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

  var a_position = gl.getAttribLocation(program, "position");
  gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_position);

  u_projectionMatrix = gl.getUniformLocation(program, "projectionMatrix");
  u_modelViewMatrix = gl.getUniformLocation(program, "modelviewMatrix");

  // make 27 cubes
  initializeCubes();

  var drag = false;
  var previousX, old_y;
  var mouseDown = function(e) {
     drag = true;
     previousX = e.pageX,
     old_y = e.pageY;
     e.preventDefault();
     return false;
  };

  var mouseUp = function(e) {
     drag = false;
  };

  var mouseMove = function(e) {
    if (!drag) {
      return false;
    }
    var dX = e.pageX - previousX;
    var dY = e.pageY - old_y;
    let offsetTHETA = dX * 2 * Math.PI/canvas.width;
    let offsetPHI = dY*2*Math.PI/canvas.height;
    var phiDeg = (PHI / Math.PI * 180) % 360;
    if (phiDeg < 0 || Math.abs(phiDeg) > 180 && Math.abs(phiDeg) < 270) {
      if (phiDeg < -180) {
        THETA -= offsetTHETA;
      } else {
        THETA += offsetTHETA;
      }
      // console.log("break point 1");
      // console.log("THETA:",THETA,"phiDeg:","phiDeg");
    } else {
      if (Math.abs(phiDeg) > 180.0) {
        THETA += offsetTHETA;
      } else {
        THETA -= offsetTHETA;
      }
      // console.log("break point 2");
      // console.log("THETA:",THETA,"phiDeg:","phiDeg");
    }
    PHI -= offsetPHI;
    console.log("PHI",PHI);
    previousX = e.pageX;
    old_y = e.pageY;
    e.preventDefault();
  };

  canvas.addEventListener("mousedown", mouseDown, false);
  canvas.addEventListener("mouseup", mouseUp, false);
  canvas.addEventListener("mouseout", mouseUp, false);
  canvas.addEventListener("mousemove", mouseMove, false);
  
  // element id: [axis along which it rotates][+ or -][value -1,0,or 1][cw or ccw0]
  // 1 cw
  document.getElementById("xneg1cw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("1a"));
  };
  // 1 ccw
  document.getElementById("xneg1ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("1b"));
  };
  // 2 cw
  document.getElementById("x0cw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("2a"));
  };
  // 2 ccw  
  document.getElementById("x0ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("2b"));
  };
  // 3 cw
  document.getElementById("xpos1cw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("3a"));
  };
  // 3 ccw
  document.getElementById("xpos1ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("3b"));
  };
  // 4 cw
  document.getElementById("yneg1ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("4a"));
  };
  // 4 ccw
  document.getElementById("yneg1cw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("4b"));
  };
  // 5 cw
  document.getElementById("y0cw").onclick = function() { 
    cubeMoveQueue.push(getFaceByViewAngle("5a"));
  };
  // 5 ccw
  document.getElementById("y0ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("5b"));
  };
  // 6 cw
  document.getElementById("ypos1cw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("6a"));
  };
  // 6 ccw
  document.getElementById("ypos1ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("6b"));
  };
  // 7 cw
  document.getElementById("zpos1ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("7a"));
  };
  // 7 ccw
  document.getElementById("zpos1cw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("7b"));
  };
  // 8 cw
  document.getElementById("z0ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("8a"));
  };
  // 8 ccw
  document.getElementById("z0cw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("8b"));
  };
  // 9 cw
  document.getElementById("zneg1ccw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("9a"));
  };
  // 9 ccw
  document.getElementById("zneg1cw").onclick = function() {
    cubeMoveQueue.push(getFaceByViewAngle("9b"));
  };

  document.getElementById("scramble_btn").onclick = function() {
    scramble();
  };

  render();
}

function setRotationSpeed(sliderValue) {
  rotationSpeed  = baseRotationSpeed/(sliderValue); // = 100/sliderVvalue
  console.log("animation delay: ",rotationSpeed);
}

function scramble() {

  var allFaces = [
    "1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b", 
    "5a", "5b", "6a", "6b", "7a", "7b","8a", "8b", "9a", "9b"
  ];
  scrambleValue = document.getElementById("scrambler").value;
  if (cubeMoveQueue.length != 0) {
    alert("There are already moves in the animation queue!");
  } else {
    let rand;
    for (let i = 0; i < scrambleValue; i++) {
       rand = Math.floor(Math.random()*18);
       console.log("RAND:", rand);
       cubeMoveQueue.push(getFaceByViewAngle(allFaces[rand]));
    }
  }
  // render();
}

// handle keyboard input parameters
document.onkeydown = function(e) {
  e = e || window.event;
  var key = e.which || e.keyCode;
  switch(key) {
    case(81):
      cubeMoveQueue.push(getFaceByViewAngle("1a"));
      break;
    case(65):
      cubeMoveQueue.push(getFaceByViewAngle("1b"));
      break;
    case(87):
      cubeMoveQueue.push(getFaceByViewAngle("2a"));
      break;
    case(83):
      cubeMoveQueue.push(getFaceByViewAngle("2b"));
      break;
    case(69):
      cubeMoveQueue.push(getFaceByViewAngle("3a"));
      break;
    case(68):
      cubeMoveQueue.push(getFaceByViewAngle("3b"));
      break;
    case(82):
      cubeMoveQueue.push(getFaceByViewAngle("7a"));
      break;
    case(70):
      cubeMoveQueue.push(getFaceByViewAngle("7b"));
      break;
    case(84):
      cubeMoveQueue.push(getFaceByViewAngle("8a"));
      break;
    case(71):
      cubeMoveQueue.push(getFaceByViewAngle("8b"));
      break;
    case(89):
      cubeMoveQueue.push(getFaceByViewAngle("9a"));
      break;
    case(72):
      cubeMoveQueue.push(getFaceByViewAngle("9b"));
      break;
    case(85):
      cubeMoveQueue.push(getFaceByViewAngle("4a"));
      break;
    case(74):
      cubeMoveQueue.push(getFaceByViewAngle("4b"));
      break;
    case(73):
      cubeMoveQueue.push(getFaceByViewAngle("5a"));
      break;
    case(75):
      cubeMoveQueue.push(getFaceByViewAngle("5b"));
      break;
    case(79):
      cubeMoveQueue.push(getFaceByViewAngle("6a"));
      break;
    case(76):
      cubeMoveQueue.push(getFaceByViewAngle("6b"));
      break;

  }
}

function initializeCubes() {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        let x = i - 1;
        let y = j - 1;
        let z = k - 1;
        // characteristic subparts for each cube
        cube[i][j][k][0] = x;
        cube[i][j][k][1] = y;
        cube[i][j][k][2] = z;
        cube[i][j][k][3] = 
            [ [-1,0,0],
              [0,-1,0],
              [0,0,-1]
            ]; // reference axis for checking solution
        cube[i][j][k][4] = mat4(); // rotation matrix
      }
    }
  }
  cube[3] = THETA;
  cube[4] = PHI;
}

function getRotationAxis(x,y,z) {
  return cube[x+1][y+1][z+1][3];
}
function getRotationMatrix(x,y,z) {
    return cube[x+1][y+1][z+1][4];
}

document.getElementById('load_input').addEventListener('change', parseInputFile, false);
function parseInputFile(event) {
  var files = event.target.files;
  var reader = new FileReader();
  var f = files[0];
  reader.onload = (function() {
      fileLoaded = true;
      return function() {
        loadedFile = JSON.parse(reader.result);
        for (var x = -1; x < 2; x++) {
          for (var y = -1; y < 2; y++) {
            for (var z = -1; z < 2; z++) {
              loadedFile[x+1][y+1][z+1][4].matrix = true;
            }
          }
        }
      }
  })(f);
  reader.readAsText(f);
}

// handle file loading upon button click
document.getElementById("load_btn").onclick = function () {
  if (!fileLoaded) {
    console.log("Load file not specified!");
  } else {
    document.getElementById('load_input').addEventListener('change', parseInputFile, false);
    cube = loadedFile;
    THETA = loadedFile[3];
    PHI = loadedFile[4];
    console.log("cube: ", cube);
    render();
  }
};


// store a text file containing the cube structure
function savefile() {
    var link = document.getElementById("download_link");
    if (cube == null) {
      console.log("Cube is empty");
      link.innerHTML = "NULL";
    } 
    else {
      var cube_textfile = JSON.stringify(cube);
      var cube_blob = new Blob([cube_textfile], {type: 'text/plain'});
      link.href = window.URL.createObjectURL(cube_blob);
      link.innerHTML = "Download";
      link.download = "my_saved_cube_states.txt";
      console.log("savefile button clicked!");
    } 
  }

function getFaceByViewAngle(face) {
  // movement correction by the view angle - phi and theta
  var oneFaces1 = ["1b","7a","3a","9b","1b","7a","3a","9b"];
  var oneFaces2 = ["1a","7b","3b","9a","1a","7b","3b","9a"];
  
  var twoFaces1 = ["2b","8a","2a","8b","2b","8a","2a","8b"];
  var twoFaces2 = ["2a","8b","2b","8a","2a","8b","2b","8a"];
  
  var threeFaces1 = ["3a","9b","1b","7a","3a","9b","1b","7a"];
  var threeFaces2 = ["3b","9a","1a","7b","3b","9a","1a","7b"];

  var fourFaces1 = ["4a","4a","4a","4a","6a","6a","6a","6a"];
  var fourFaces2 = ["4b","4b","4b","4b","6b","6b","6b","6b"];
  
  var fiveFaces1 = ["5b","5b","5b","5b","5a","5a","5a","5a"];
  var fiveFaces2 = ["5a","5a","5a","5a","5b","5b","5b","5b"];
  
  var sixFaces1 = ["6a","6a","6a","6a","4a","4a","4a","4a"];
  var sixFaces2 = ["6b","6b","6b","6b","4b","4b","4b","4b"];
  
  var sevenFaces1 = ["9b","1b","7a","3a","7a","3a","9b","1b"];
  var sevenFaces2 = ["9a","1a","7b","3b","7b","3b","9a","1a"];
  
  var eightFaces1 = ["8b","2b","8a","2a","8a","2a","8b","2b"];
  var eightFaces2 = ["8a","2a","8b","2b","8b","2b","8a","2a"];
  
  var nineFaces1 = ["7a","3a","9b","1b","9b","1b","7a","3a"];
  var nineFaces2 = ["7b","3b","9a","1a","9a","1a","7b","3b"];

  var correctedFace;
  let thetaDeg = (THETA / Math.PI * 180.0) % 360.0;
  let phiDeg = (PHI / Math.PI * 180.0) % 360.0;
  let location = 0;
  let backXYplane = -1;
  console.log(" pressed. theta: ",thetaDeg,"phi: ",phiDeg);

  if ((phiDeg >= -180 && phiDeg < 0) || (phiDeg >= 180 && phiDeg < 360)) {
    backXYplane = 1; 
  } else {
    backXYplane = 0;
  }

  if(backXYplane) {
    // handle if phi lies behind xy-plane
    // divide theta into 4 sections of 90 degrees
    if (thetaDeg < -315 || (thetaDeg >= -45 && thetaDeg < 45) || thetaDeg >= 315) {
      location = 0;
    } else if ((thetaDeg >= -315 && thetaDeg < -225) || (thetaDeg >= 45 && thetaDeg < 135)) {
      location = 1;
    } else if ((thetaDeg >= -225 && thetaDeg < -135) || (thetaDeg >=135 && thetaDeg < 225)) {
      location = 2;
    } else if ((thetaDeg >= -135 && thetaDeg < -45) || (thetaDeg >= 215 && thetaDeg < 315)) {
      location = 3;
    } 
    else if(!backXYplane) {
      // handle if phi lies in front of xy-plane
      if (thetaDeg < -315 || (thetaDeg >= -45 && thetaDeg < 45) || thetaDeg >= 315) {
        location = 4;
      } else if ((thetaDeg >= -315 && thetaDeg < -225) || (thetaDeg >= 45 && thetaDeg < 135)) {
        location = 5;
      } else if ((thetaDeg >= -225 && thetaDeg < -135) || (thetaDeg >=135 && thetaDeg < 225)) {
        location = 6;
      } else if ((thetaDeg >= -135 && thetaDeg < -45) || (thetaDeg >= 215 && thetaDeg < 315)) {
        location = 7;
      }
    }
    else {
      location = 0;
    }
  }
  switch(face) {
    case "1b":
      correctedFace = oneFaces1[location];
      break;
    case "1a":
      correctedFace = oneFaces2[location];
      break;
    case "2b":
      correctedFace = twoFaces1[location];
      break;
    case "2a":
      correctedFace = twoFaces2[location];
      break;
    case "3a":
      correctedFace = threeFaces1[location];
      break;
    case "3b":
      correctedFace = threeFaces2[location];
      break;
    case "4a":
      correctedFace = fourFaces1[location];
      break;
    case "4b":
      correctedFace = fourFaces2[location];
      break;
    case "5a":
      correctedFace = fiveFaces1[location];
      break;
    case "5b":
      correctedFace = fiveFaces2[location];
      break;
    case "6a":
      correctedFace = sixFaces1[location];
      break;
    case "6b":
      correctedFace = sixFaces2[location];
      break;
    case "7a":
      correctedFace = sevenFaces1[location];
      break;
    case "7b":
      correctedFace = sevenFaces2[location];
      break;
    case "8a":
      correctedFace = eightFaces1[location];
      break;
    case "8b":
      correctedFace = eightFaces2[location];  
      break;
    case "9b":
      correctedFace = nineFaces1[location];
      break;
    case "9a":
      correctedFace = nineFaces2[location];
      break;
  }
  console.log("CUBE FACE: old: ", face, " corrected: ",correctedFace);
  return correctedFace;
}

function rotation(face) {
    updateRotationMatrix(face);
    currentAngle += rotationAngle;
    if (currentAngle == 90) {
      clearInterval(setIntervalTimerId);
      inRotation = false;
      currentAngle = 0;
      updatePosition(face);
    }
  }
  function updateRotationMatrix(face) {
    var x,y,z;
    var dir,value;
    var mainAxis;
    var finalRotationMatrix;
    switch (face) {
      case "1b":
        mainAxis = 0; value = -1; dir = 1;
      break;
      case "1a":
        mainAxis = 0; value = -1; dir = 0;
      break;
      case "2b":
        mainAxis = 0;value = 0;dir = 1;
      break;
      case "2a":
        mainAxis = 0;value = 0;dir = 0;
      break;
      case "3a":
        mainAxis = 0; value = 1; dir = 0;
      break;
      case "3b":
        mainAxis = 0; value = 1; dir = 1;
      break;
  
      case "6a":
        mainAxis = 1;value = 1;dir = 0;
      break;
      case "6b":
        mainAxis = 1;value = 1;dir = 1;
      break;
      case "4a":
        mainAxis = 1;value = -1;dir = 1;
      break;
      case "4b":
        mainAxis = 1;value = -1;dir = 0;
      break;
      case "5a":
        mainAxis = 1;value = 0;dir = 1;
      break;
      case "5b":
        mainAxis = 1;value = 0;dir = 0;
      break;
      
      case "7a":
        mainAxis = 2;value = 1;dir = 0;
      break;
      case "7b":
        mainAxis = 2;value = 1;dir = 1;
      break;
      case "9b":
        mainAxis = 2;value = -1;dir = 1;
      break;
      case "9a":
        mainAxis = 2;value = -1;dir = 0;
      break;
      case "8a":
        mainAxis = 2;value = 0;dir = 0;
      break;
      case "8b":
        mainAxis = 2;value = 0;dir = 1;
      break;
    }
    for (x = -1; x < 2; x++) {
      for (y = -1; y < 2; y++) {
        for (z = -1; z < 2; z++) {
          // check if cubie is in the plane of the face being turned
          if (cube[x+1][y+1][z+1][mainAxis] == value) {
            finalRotationMatrix = getRotationMatrix(x,y,z);
            if (!dir) {
              finalRotationMatrix = mult(finalRotationMatrix,rotate(rotationAngle,
                              getRotationAxis(x,y,z)[mainAxis]));
            } else {
              finalRotationMatrix = mult(finalRotationMatrix,rotate(rotationAngle,
                              negate(getRotationAxis(x,y,z)[mainAxis])));
            }
            cube[x+1][y+1][z+1][4] = finalRotationMatrix;
          }
        }
      }
    }
  }
  
// updates position
// specify axis,swapVar1,swapVar2 and value for each position (x,y,z) 
function update(x1, y1, z1, axis, axisValue, swapVar1, swapVar2) {
  var x = x1 + 1;
  var y = y1 + 1; 
  var z = z1 + 1;
  var tempSwap = [];
  
  // console.log("ref before:",cube[x][y][z][3]);
  // change cube subelements for specified axis (side) only
  if (cube[x][y][z][axis] == axisValue) { 
    // swap position coordinates (x,y,z) by the derived generalization
    tempSwap = cube[x][y][z][swapVar1];
    cube[x][y][z][swapVar1] = cube[x][y][z][swapVar2];
    cube[x][y][z][swapVar2] = -1*tempSwap;   

    // swap the reference axes as well
    tempSwap = cube[x][y][z][3][swapVar2];
    cube[x][y][z][3][swapVar2] = negate(cube[x][y][z][3][swapVar1]);
    cube[x][y][z][3][swapVar1] = tempSwap;
  }
  // console.log("ref now:",cube[x][y][z][3]);
}
  
function updatePosition(face) {
  var axis, swapVar1, swapVar2, axisValue;
  switch (face) {
    // axis: x-axis
    case "1b":
      axis = 0; swapVar1 = 2; swapVar2 = 1; axisValue = -1;
      break;
    case "1a":
      axis = 0; swapVar1 = 1; swapVar2 = 2; axisValue = -1;
      break;
    case "3a":
      axis = 0; swapVar1 = 1; swapVar2 = 2; axisValue = 1;
      break;
    case "3b":
      axis = 0; swapVar1 = 2; swapVar2 = 1; axisValue = 1;
      break;
    case "2b":
    axis = 0; swapVar1 = 2; swapVar2 = 1; axisValue = 0;
      break;
    case "2a":
    axis = 0; swapVar1 = 1; swapVar2 = 2; axisValue = 0;
      break;

    // axis: y-axis
    case "6a":
      axis = 1; swapVar1 = 2; swapVar2 = 0; axisValue = 1;
      break;
    case "6b":
      axis = 1; swapVar1 = 0; swapVar2 = 2; axisValue = 1;
      break;
    case "4a":
      axis = 1; swapVar1 = 0; swapVar2 = 2; axisValue = -1;
      break;
    case "4b":
      axis = 1; swapVar1 = 2; swapVar2 = 0; axisValue = -1;
      break;
    case "5a":
      axis = 1; swapVar1 = 0; swapVar2 = 2; axisValue = 0;
      break;
    case "5b":
      axis = 1; swapVar1 = 2; swapVar2 = 0; axisValue = 0;
      break;

    // axis: z-axis
    case "7a":
      axis = 2; swapVar1 = 0; swapVar2 = 1; axisValue = 1;
      break;
    case "7b":
      axis = 2; swapVar1 = 1; swapVar2 = 0; axisValue = 1;
      break;
    case "8a":
      axis = 2; swapVar1 = 0; swapVar2 = 1; axisValue = 0;
      break;
    case "8b":
      axis = 2; swapVar1 = 1; swapVar2 = 0; axisValue = 0;
      break;
    case "9b":
      axis = 2; swapVar1 = 1; swapVar2 = 0; axisValue = -1;
      break;
    case "9a":
      axis = 2; swapVar1 = 0; swapVar2 = 1; axisValue = -1;
      break;
  }
  for (let x = -1; x < 2; x++) {
    for (let y = -1; y < 2; y++) {
      for (let z = -1; z < 2; z++) {
        update(x, y, z, axis, axisValue, swapVar1, swapVar2);
      }
    }
  }
}
  
  
function checkSolution() {
  var refCenterCube;
  var centerCube;
  // compare reference axis against the central cube, which remains invariant
  centerCube = cube[0][0][0];
  refCenterCube = centerCube[3];
  for (let x = -1; x < 2; x++) {
    for (let y = -1; y < 2; y++) {
      for (let z = -1; z < 2; z++) {
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            // for all cubes not at the center,
            if (cube[x+1][y+1][z+1][3][i][j] != refCenterCube[i][j]) {
              if (x == 0 && z == 0) {
                if (cube[x+1][y+1][z+1][3][1][j] != refCenterCube[1][j]) {
                  return false;
                }
              }else if (x == 0 && y == 0) {
                if (cube[x+1][y+1][z+1][3][2][j] != refCenterCube[2][j]) {
                  return false;
                }
              }else if (y == 0 && z == 0) {
                if (cube[x+1][y+1][z+1][3][0][j] != refCenterCube[0][j]) {
                  return false;
                }
              }else {
                return false;
              }
            }
          }
        }
      }
    }
  }
  return true;
}
  

function assignEachCubeColors(x,y,z) {
  for (var i = 0; i < surfaceColors.length; i++) {
    cubeSideColors[i] = surfaceColors[i];
    // console.log("assigning color: ", surfaceColors[i], " to vertexColor: ", cubeSideColors[i]);
  }
  if (z != -1) {
    for (var i = 0; i < 4; i++) {
        cubeSideColors[i] = colors["black"];
    }
  }
  if (z != 1) {
    for (var i = 4; i < 8; i++) {
        cubeSideColors[i] = colors["black"];
    }
  }
  if (x != -1) {
    for (var i = 8; i < 12; i++) {
        cubeSideColors[i] = colors["black"];
    }
  }
  if (x != 1) {
    for (var i = 12; i < 16; i++) {
        cubeSideColors[i] = colors["black"];
    }
  }
  if (y != -1) {
    for (var i = 16; i < 20; i++) {
        cubeSideColors[i] = colors["black"];
    }
  }
  if (y != 1) {
    for (var i = 20; i < 24; i++) {
        cubeSideColors[i] = colors["black"];
    }
  }
  // coloring all black first then coloring non-black colors -> makes it more difficult 
  // to determine which sides to color, and that color need not be over-colored
  // so colored non-black first, then colored black accordingly afterwards
}

function render() {
  if (cubeMoveQueue.length != 0 && !inRotation) {
    inRotation = true;
    let faceToRotate = cubeMoveQueue.shift();
    setIntervalTimerId = setInterval(
      function() {
        rotation(faceToRotate)
      }, 
      rotationSpeed
    );
  }

  gl.clearColor(240/255, 248/255, 255/255, 1.0); // #aliceblue color background fill
  gl.clearDepth(1.0);
  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
  gl.viewport( 0, 0, canvas.width, canvas.height );
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  // Set the camera position at each render
  var eye_x = cameraRadius * Math.sin(THETA) * Math.cos(PHI);
  var eye_y = cameraRadius * Math.sin(THETA) * Math.sin(PHI);
  var eye_z = cameraRadius * Math.cos(PHI);
  eye = vec3(eye_x, eye_y, eye_z);

  // using the perspective function,
  // which returns a 4x4 matrix
  projMatrix = perspective(field_of_view_vertical, aspect, near, far);
  mvMatrix = lookAt(eye, at, up);
  var x, y, z;
  for (x = -1; x <= 1; x++) {
    for (y = -1; y <= 1; y++) {
      for (z = -1; z <= 1; z++) {
        // breaking into each cube
        if (x !=0 || y !=0 || z!=0) {
          var tmp = mvMatrix;
          mvMatrix = mult(mvMatrix, getRotationMatrix(x,y,z));
          mvMatrix = mult(mvMatrix, translate(vec3(x*2.1,y*2.1,z*2.1)));
          // paint colors by coordinate
          assignEachCubeColors(x, y, z);
          colorBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, flatten(cubeSideColors), gl.STATIC_DRAW);
          a_color = gl.getAttribLocation(program, "color");
          gl.vertexAttribPointer(a_color, 4, gl.FLOAT, false, 0 , 0);
          gl.enableVertexAttribArray(a_color);
          gl.uniformMatrix4fv(u_projectionMatrix, false, flatten(projMatrix));
          gl.uniformMatrix4fv(u_modelViewMatrix, false, flatten(mvMatrix));
          gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_BYTE, 0);
          mvMatrix = tmp;
        }
      }
    }
  }
  let solved = checkSolution();
  if (solved) {
    document.getElementById("cube_state").innerHTML = "solved";
  } else {
    document.getElementById("cube_state").innerHTML = "Not solved";
  }
  requestAnimFrame(render);
}

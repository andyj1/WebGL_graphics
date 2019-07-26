/* 
 * ECE462 - Computer Graphics Spring 2019
 * Environment Mapping using Skybox and Cubemap
 * Jongoh (Andy) Jeong 
 * May 5, 2019

 * Useful references for texture mapping
 1) http://math.hws.edu/graphicsbook/c7/s3.html
 2) https://webglfactory.blogspot.com/2011/05/adding-textures.html
 */
var gl;
var canvas;

// separate shader program for skybox and reflectingObject
var shaderProgramSkybox;
var shaderProgramReflectingObject;
var imageLoadCounter = 0;

// Skybox 
var skyboxVertexBuffer;
var skyboxFaceBuffer;
var skyBoxCubeMap;
var skyboxVertex = [];
var skyboxFace = [];

// ReflectingObject
var reflectingObjectVertexBuffer;
var reflectingObjectFaceBuffer;
var reflectingObjectNormalBuffer;
var reflectingObjectVertex = [];
var reflectingObjectFace = [];
var reflectingObjectNormal = [];

// mvMatrix is applied to skybox
var viewTransformMatrix = mat3.create();

// Model view matrix stack for skybox and the object
var mvMatrixStack = [];

// initialization
var mvMatrix = mat4.create(); // Create ModelView matrix
var pMatrix = mat4.create(); //Create Projection matrix
var nMatrix = mat3.create(); // Create the Normal matrix

// parameter for camera
var cameraQuaternion = quat.create();

// parameters for animation
var reflectingObjectRotationValue = 0.0;
var reflectingObjectMoveValue = 0.0;
var skyboxRotationValue = 0.0;
var skyboxMoveValue = 0.0;

// parametes for lookAt()
var eye = vec3.fromValues(0.0, 0.0, 0.0);
var at = vec3.fromValues(0.0, 0.0, -1.0);
var up = vec3.fromValues(0.0, 1.0, 0.0);
var newAt = vec3.create();

// initial light source location
var lightPosEye = vec4.fromValues(0.0, 0.0, 0.0, 1.0);

// parameters for light source - ambient, diffuse, specular
var Ia = vec3.fromValues(1, 1, 1);
var Id = vec3.fromValues(1, 1, 1);
var Is = vec3.fromValues(1, 1, 1);

// for tracking frames per second (FPS)
var prevFrameTime = 0;      //the time of the last frame
var cumulativeFrameTime = 0;       //current fps
var numAccountedFrames = 0; //number of frames we've looked at so far

// scaling object
var newScale;

// eye position
var newEye;

// adjust image and reflecting object by user's selection
var imageIndex = 0;
var objectIndex = 0;

// keyboard event flags
var reflectingObjectRotationLeft = false;
var reflectingObjectRotationRight = false;
var reflectingObjectMoveUp = false;
var reflectingObjectMoveDown = false;
var skyboxRotationLeft = false;
var skyboxRotationRight = false;
var skyboxMoveUp = false;
var skyboxMoveDown = false;

// for display, make global values for adjustment
var eyeX, eyeY, eyeZ;
var scaleX, scaleY, scaleZ;
var lightX, lightY, lightZ;
var shininess, perspectiveAngle;

window.onload = init;

// images from http://www.humus.name/index.php?page=Textures&start=8 and other misc. online websites
var images = [
    ['../img/yokohama/posx.jpg', '../img/yokohama/posy.jpg','../img/yokohama/posz.jpg',
    '../img/yokohama/negx.jpg', '../img/yokohama/negy.jpg', '../img/yokohama/negz.jpg'],

    ['../img/street/posx.png', '../img/street/posy.png','../img/street/posz.png',
    '../img/street/negx.png', '../img/street/negy.png', '../img/street/negz.png'],
    
    ['../img/streets/posx.jpg', '../img/streets/posy.jpg','../img/streets/posz.jpg',
    '../img/streets/negx.jpg', '../img/streets/negy.jpg', '../img/streets/negz.jpg'],
    
    ['../img/grimmnight/posx.png', '../img/grimmnight/posy.png','../img/grimmnight/posz.png',
    '../img/grimmnight/negx.png', '../img/grimmnight/negy.png', '../img/grimmnight/negz.png'],
    
    ['../img/interstellar/posx.png', '../img/interstellar/posy.png','../img/interstellar/posz.png', 
    '../img/interstellar/negx.png', '../img/interstellar/negy.png', '../img/interstellar/negz.png'],
    
    ['../img/miramar/posx.png', '../img/miramar/posy.png','../img/miramar/posz.png',
    '../img/miramar/negx.png', '../img/miramar/negy.png', '../img/miramar/negz.png'],
    
    ['../img/stormydays/posx.png', '../img/stormydays/posy.png','../img/stormydays/posz.png',
    '../img/stormydays/negx.png', '../img/stormydays/negy.png', '../img/stormydays/negz.png'],
    
    ['../img/violentdays/posx.png', '../img/violentdays/posy.png','../img/violentdays/posz.png',
    '../img/violentdays/negx.png', '../img/violentdays/negy.png', '../img/violentdays/negz.png'],
];

// utility functions for model view matrices
function mvPopMatrix() {
    if (mvMatrixStack.length === 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}

// set uniforms for light components
function setMatrixUniforms(shaderProgram) {
    sendModelViewMatrixToShader(shaderProgram);
    sendProjectionMatrixToShader(shaderProgram);
    sendNormalMatrixToShader(shaderProgram);
    
    lightX = document.getElementById("light-x").value;
    lightY = document.getElementById("light-y").value;
    lightZ = document.getElementById("light-z").value;
    newLightSource = vec3.fromValues(lightX, lightY, lightZ);

    // display values
    document.getElementById("lightx-tag").innerHTML = lightX;
    document.getElementById("lighty-tag").innerHTML = lightY;
    document.getElementById("lightz-tag").innerHTML = lightZ;

    gl.uniform3fv(shaderProgram.uniformLightPositionLoc, newLightSource);
    gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, Ia);
    gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, Id);
    gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, Is);

}

// converts degree to radians
function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

// initialize gl-context
function createGLContext(canvas) {
    // try webgl and experimental-webgl contexts for the browser
    var names = ["webgl", "experimental-webgl"];
    var context;
    for (var i = 0; i < names.length; i++) {
        try {
            context = canvas.getContext(names[i]);
        } catch (e) {}
        if (context) {
            break;
        }
    }
    if (context) {
        context.viewportWidth = canvas.width;
        context.viewportHeight = canvas.height;
        document.getElementById("resolution").innerHTML = 
            "Resolution: "+ context.viewportWidth + " x " + context.viewportHeight;
    } else {
        alert("Failed to create WebGL context!");
    }
    return context;
}

/*
 * Load shader data from the provided id.
 * @param {String} id An id of target object
 * @return shader The shader data
 */
function loadShader(id) {
    // lookup shader in html document
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var shaderSource = "";
    var currentChild = shaderScript.firstChild;
    while (currentChild) {
        // if the shader has text format child
        if (currentChild.nodeType === 3) { // 3 === TEXT_NODE
            shaderSource += currentChild.textContent; // append the text to shader by line
        }
        currentChild = currentChild.nextSibling;
    }

    var shader;
    if (shaderScript.type === "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type === "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        shader = null;
    }

    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function setupShaders(vertexShaderID, fragmentShaderID) {
    var shaderProgram;
    var fragmentShader = loadShader(fragmentShaderID);
    var vertexShader = loadShader(vertexShaderID);
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.log("Error linking the program: " + gl.getProgramInfoLog(shaderProgram));
    }

    // Attach vertex positions to vertexPositionAttribute field of the shaderProgram
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    
    // Attach normal for lighting calculation to vertexNomalAttribute field of the shaderProgram
    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    
    // Attach colors to vertexColorAttribute field of the shaderProgram
    shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
    
    // Attach uniforms to uniform matrix fields of the shaderProgram
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");

    // Attach uniforms for lighting to uniformLoc fields of the shaderProgram
    shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
    shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");
    shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
    shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
    shaderProgram.skyboxSampler = gl.getUniformLocation(shaderProgram, "uSkyboxSampler");
    shaderProgram.viewTransformMatrix = gl.getUniformLocation(shaderProgram, "uViewTransform");

    return shaderProgram;
}

function setupSkyboxBuff() {
    // vertices for skybox faces --> ARRAY_BUFFER
    skyboxVertex = [
        // Front face
        -1.0, -1.0, 1.0,
        1.0, -1.0, 1.0,
        1.0, 1.0, 1.0, 
        -1.0, 1.0, 1.0,

        // Back face
        -1.0, -1.0, -1.0, 
        -1.0, 1.0, -1.0,
        1.0, 1.0, -1.0,
        1.0, -1.0, -1.0,

        // Top face
        -1.0, 1.0, -1.0, 
        -1.0, 1.0, 1.0,
        1.0, 1.0, 1.0,
        1.0, 1.0, -1.0,

        // Bottom face
        -1.0, -1.0, -1.0,
        1.0, -1.0, -1.0,
        1.0, -1.0, 1.0, 
        -1.0, -1.0, 1.0,

        // Right face
        1.0, -1.0, -1.0,
        1.0, 1.0, -1.0,
        1.0, 1.0, 1.0,
        1.0, -1.0, 1.0,

        // Left face
        -1.0, -1.0, -1.0, 
        -1.0, -1.0, 1.0, 
        -1.0, 1.0, 1.0, 
        -1.0, 1.0, -1.0
    ];
    skyboxVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skyboxVertex), gl.STATIC_DRAW);

    // indices for skybox faces --> ELEMENT_ARRAY_BUFFER
    skyboxFace = [
        0, 1, 2,        0, 2, 3,    // front
        4, 5, 6,        4, 6, 7,    // back
        8, 9, 10,       8, 10, 11,  // top
        12, 13, 14,     12, 14, 15, // bottom
        16, 17, 18,     16, 18, 19, // right
        20, 21, 22,     20, 22, 23  // left
    ];
    skyboxFaceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyboxFaceBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(skyboxFace), gl.STATIC_DRAW);
}

// vertices, faces, normals for reflecting object
function setupReflectingObjectBuffer() {

    reflectingObjectVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, reflectingObjectVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(reflectingObjectVertex), gl.STATIC_DRAW);

    reflectingObjectFaceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, reflectingObjectFaceBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(reflectingObjectFace), gl.STATIC_DRAW);

    reflectingObjectNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, reflectingObjectNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(reflectingObjectNormal), gl.STATIC_DRAW);
}

// send mvMatrix to shader
function sendModelViewMatrixToShader(shaderProgram) {
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

// send pMatrix to shader
function sendProjectionMatrixToShader(shaderProgram) {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
}

// send ViewTransformMatrix to shader
function sendViewTransformMatrixToShader(shaderProgram) {
    gl.uniformMatrix3fv(shaderProgram.viewTransformMatrix, false, viewTransformMatrix);
}

// send nMatrix to shader
function sendNormalMatrixToShader(shaderProgram) {
    mat3.fromMat4(nMatrix, mvMatrix);
    mat3.transpose(nMatrix, nMatrix);
    mat3.invert(nMatrix, nMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

// draw a frame
function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var newUp = vec3.create();
    var newView = vec3.create();

    eyeX = document.getElementById("eye-x").value;
    eyeY = document.getElementById("eye-y").value;
    eyeZ = document.getElementById("eye-z").value;
    newEye = vec3.fromValues(eyeX, eyeY, eyeZ);
    // console.log("newEye: ", newEye);
    
    scaleX = document.getElementById("scale-x").value;
    scaleY = document.getElementById("scale-y").value;
    scaleZ = document.getElementById("scale-z").value;
    newScale = [scaleX, scaleY, scaleZ];

    // Perform quaternion rotation on up vector
    //    transform 'up' with quaternion 'cameraQuaternion' to output to 'newUp'
    vec3.transformQuat(newUp, up, cameraQuaternion);

    // Perform quaternion rotation on view vector
    //    transform 'at' with quaternion 'cameraQuaternion' to output to 'newView'
    vec3.transformQuat(newView, at, cameraQuaternion);

    // Create a new lookat point from quaternion-rotated parameters
    vec3.add(newAt, newEye, newView);

    // manipulate perspective angle by recalculating perspective matrix and attaching to the uniform
    perspectiveAngle = document.getElementById("perspective-angle").value;
    gl.useProgram(shaderProgramSkybox);
    mat4.perspective(pMatrix, degToRad(perspectiveAngle), gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
    setMatrixUniforms(shaderProgramSkybox);    

    /* Generate lookat matrix from new parameters
     *     lookAt(out, eye, center, up)
     *      out: [mat4] frustum matrix will be written into
     *      eye: [vec3] Position of the viewer
     *      center: [vec3] Point the viewer is looking at
     *      up: [vec3] vec3 pointing up
     */
    mat4.lookAt(mvMatrix, newEye, newAt, newUp);

    // assure that 6 images are loaded for cubemap
    if (imageLoadCounter === 6) {
        // draw skybox
        gl.useProgram(shaderProgramSkybox);
        gl.depthMask(false);
        mvPushMatrix();
        gl.enableVertexAttribArray(shaderProgramSkybox.vertexPositionAttribute);
        drawSkybox();
        gl.disableVertexAttribArray(shaderProgramSkybox.vertexPositionAttribute);
        mat3.fromMat4(viewTransformMatrix, mvMatrix);
        mvPopMatrix();

        //draw ReflectingObject
        mat3.invert(viewTransformMatrix, viewTransformMatrix);
        mat3.normalFromMat4(nMatrix, mvMatrix);
        gl.useProgram(shaderProgramReflectingObject);

        // shininess control
        shininess = document.getElementById("shininess").value;

        var uShininessLoc = gl.getUniformLocation(shaderProgramReflectingObject, "uShininess");
        gl.uniform1f(uShininessLoc, shininess);

        sendViewTransformMatrixToShader(shaderProgramReflectingObject);
        gl.depthMask(true);
        gl.enableVertexAttribArray(shaderProgramReflectingObject.vertexPositionAttribute);
        gl.enableVertexAttribArray(shaderProgramReflectingObject.vertexNormalAttribute);
        mvPushMatrix();
        drawReflectingObject(newScale);
        mvPopMatrix();
        gl.disableVertexAttribArray(shaderProgramReflectingObject.vertexPositionAttribute);
        gl.disableVertexAttribArray(shaderProgramReflectingObject.vertexNormalAttribute);
    }
}

// Calculates the elapsed time and perform the action based on states (flags)
var prevTime = 0;
function animate() {
    var currentTime = new Date().getTime();
    var elapsed = 0;
    if (prevTime !== 0) {
        elapsed = currentTime - prevTime;
    }
    prevTime = currentTime;
    if (skyboxRotationLeft) { skyboxRotationValue += 100.0 * (elapsed / 1000); }
    if (skyboxRotationRight) { skyboxRotationValue -= 100.0 * (elapsed / 1000); }
    if (reflectingObjectRotationLeft) { reflectingObjectRotationValue += 100.0 * (elapsed / 1000); }
    if (reflectingObjectRotationRight) { reflectingObjectRotationValue -= 100.0 * (elapsed / 1000); }
    if (skyboxMoveUp) { skyboxMoveValue += 100.0 * (elapsed / 1000); }
    if (skyboxMoveDown) { skyboxMoveValue -= 100.0 * (elapsed / 1000); }
    if (reflectingObjectMoveUp) {  reflectingObjectMoveValue += 100.0 * (elapsed / 1000); }
    if (reflectingObjectMoveDown) { reflectingObjectMoveValue -= 100.0 * (elapsed / 1000); }
}

// this takes 3D .obj file and makes a mesh by parsing vertices 'v' and faces 'f'
// limitation: this doesn't parse vt, vn fields, which limits complex object inputs
var objectFiles = ["../obj/teapot_0.obj", "../obj/cow.obj", "../obj/cube.obj",
                    "../obj/cube2.obj", "../obj/icosahedron.obj", "../obj/octahedron.obj",
                    "../obj/shuttle.obj","../obj/tetrahedron.obj","../obj/violincase.obj",
                    "../obj/airboat.obj","../obj/teddybear.obj" ];

function importReflectingObjectData(file) {
    /* Warning on jQuery synchronous request:
    * [Deprecation] Synchronous XMLHttpRequest on the main thread is deprecated because of its  
    *    detrimental effects to the end user's experience. 
    *    For more help, check https://xhr.spec.whatwg.org/.
    * ** doesn't work on asynchronous request initially
    */
   $.ajaxSetup({ async: false }); 

    $.get(file, function(data) { // takes file as 'data' automatically
        var text = data.split("\n");
        $.each(text, function(index,lines) { // syntax: $('element').each(function (index, value)
            var values = lines.split(/\s+/); // split on space
            switch(values[0]) {
                case 'v':
                    reflectingObjectVertex.push(parseFloat(values[1]));
                    reflectingObjectVertex.push(parseFloat(values[2]));
                    reflectingObjectVertex.push(parseFloat(values[3]));
                    break;
                case 'f':
                    reflectingObjectFace.push(parseInt(values[1]) - 1); //face 'f' index starts from 1
                    reflectingObjectFace.push(parseInt(values[2]) - 1);
                    reflectingObjectFace.push(parseInt(values[3]) - 1);
                    break;
            }
        });
    });
    $.ajaxSetup({ async: true });
}

// upon window.onload, init() is called
function init() {
    // instructions
    var jquery_body = $("#config");
    jquery_body.append('\<li>Skybox orientation<\/li>')
    jquery_body.append('\<table> \
    <tr><em style="color:blue">W</em> for skybox roll up<\/br><\/tr> \
    <tr><em style="color:blue">S</em> for skybox roll down<\/br><\/tr> \
    <tr><em style="color:blue">A<\/em> for skybox roll left<\/br><\/tr> \
    <tr><em style="color:blue">D<\/em> for skybox roll right<\/br><\/tr> \
    <tr>&nbsp;&nbsp;<\/tr> \
    \<li>Reflecting Object orientation<\/li> \
    <tr><em style="color:blue">Up</em> to turn the object upward<\/br><\/tr> \
    <tr><em style="color:blue">Down</em> to turn the object downward<\/br><\/tr> \
    <tr><em style="color:blue">Left<\/em> to turn the object leftward<\/br><\/tr> \
    <tr><em style="color:blue">Right<\/em> to turn the object rightward<\/br><\/tr> \
    <\/table>');

    document.getElementById("skybox").onchange = changeImageIndex;
    document.getElementById("object").onchange = changeReflectingObject;

    shininess = document.getElementById("shininess").value;
    eyeX = document.getElementById("eye-x").value;
    eyeY = document.getElementById("eye-y").value;
    eyeZ = document.getElementById("eye-z").value;
    lightX = document.getElementById("light-x").value;
    lightY = document.getElementById("light-y").value;
    lightZ = document.getElementById("light-z").value;
    perspectiveAngle = document.getElementById("perspective-angle").value;

    

    // initiate gl canvas
    canvas = document.getElementById("gl-canvas");
    gl = createGLContext(canvas);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    
    // shaders
    shaderProgramSkybox = setupShaders("shader-vs-skybox", "shader-fs-skybox");
    shaderProgramReflectingObject = setupShaders("shader-vs-reflectingObject", "shader-fs-reflectingObject");
    
    perspectiveAngle = document.getElementById("perspective-angle").value;
    
    // skybox
    gl.useProgram(shaderProgramSkybox);
    mat4.perspective(pMatrix, degToRad(perspectiveAngle), gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
    setMatrixUniforms(shaderProgramSkybox);    

    // reflecting object
    gl.useProgram(shaderProgramReflectingObject);
    setMatrixUniforms(shaderProgramReflectingObject);    
    importReflectingObjectData(objectFiles[objectIndex]);    
    calculateNormalReflectingObject();
    setupSkyBoxCubeMap(images[imageIndex]);
    setupSkyboxBuff();
    setupReflectingObjectBuffer();
    setupKeyboardEvent();
    tick();

}

// handle user input for cubemap
function changeImageIndex() {
    imageIndex = document.getElementById("skybox").value;
    imageLoadCounter = 0;
    setupSkyBoxCubeMap(images[imageIndex]);
    console.log("imageIndex: ", imageIndex);
}

// handle user input for the reflecting object
function changeReflectingObject() {
    objectIndex = document.getElementById("object").value;
    
    reflectingObjectFace = [];
    reflectingObjectVertex = [];
    reflectingObjectNormal = [];

    // import different file
    importReflectingObjectData(objectFiles[objectIndex]);    
    calculateNormalReflectingObject();
    
    // re-render cubemap
    imageLoadCounter = 0;
    setupSkyBoxCubeMap(images[imageIndex]);
    setupSkyboxBuff();
    setupReflectingObjectBuffer();
    
    // draw
    setupKeyboardEvent();
    tick();
}

function reset() {
    window.location.reload();
}

// animate
function tick() {
    requestAnimFrame(tick);
    drawScene();
    animate();
    trackFPS("fps-counter");
        
    // set display value
    document.getElementById("eyex-tag").innerHTML = eyeX;
    document.getElementById("eyey-tag").innerHTML = eyeY;
    document.getElementById("eyez-tag").innerHTML = eyeZ;
    // set display value
    document.getElementById("scalex-tag").innerHTML = scaleX;
    document.getElementById("scaley-tag").innerHTML = scaleY;
    document.getElementById("scalez-tag").innerHTML = scaleZ;
    // display value
    document.getElementById("shininess-tag").innerHTML = shininess;
    //display value
    document.getElementById("perspective-tag").innerHTML = perspectiveAngle;

}

function trackFPS(id) {
	var time = new Date().getTime();	// from webgl_helpers.js (not referred in the html)
	var frameTime = time - prevFrameTime;
	prevFrameTime = time;
	cumulativeFrameTime = (numAccountedFrames * cumulativeFrameTime + frameTime) / (numAccountedFrames + 1);
	numAccountedFrames++;
	if(numAccountedFrames == 30) {
		var FPS = 0;
		if(cumulativeFrameTime == 0)
			FPS = "invalid";
		else
			FPS = (1000 / cumulativeFrameTime).toFixed(2);
		document.getElementById(id).innerHTML="FPS: " + FPS;
		numAccountedFrames = 0;
		cumulativeFrameTime = 0;
	}
}

// keyboard event handler
function setupKeyboardEvent() {
    $(function() {
        // Fires when the user depresses a key. It repeats while the user keeps the key depressed.
        $(document).keydown(function(event) {
            // left_arrow
            if (event.which === 37) { 
                reflectingObjectRotationLeft = true;
            }
            // 'A'
            if (event.which === 65) { 
                skyboxRotationLeft = true;
                reflectingObjectRotationLeft = true;
            }
            // right_arrow
            if (event.which === 39) { 
                reflectingObjectRotationRight = true;
            }
            // 'D'
            if (event.which === 68) { 
                skyboxRotationRight = true;
                reflectingObjectRotationRight = true;
            }
            // up_arrow
            if (event.which === 38) { 
                reflectingObjectMoveUp = true;
            }
            // down_arrow
            if (event.which === 40) { 
                reflectingObjectMoveDown = true;
            }
            // 'W'
            if (event.which === 87) { 
            skyboxMoveUp = true;
            reflectingObjectMoveUp = true;
            }
            // 'S'
            if (event.which === 83) { 
            skyboxMoveDown = true;
            reflectingObjectMoveDown = true;
            }
            event.preventDefault();
        });

        // Fires when the user releases a key, after the default action of that key has been performed.
        $(document).keyup(function(event) {
            event.preventDefault();
            event.preventDefault();
            // left_arrow
            if (event.which === 37) { 
                reflectingObjectRotationLeft = false;
            }
            // 'A'
            if (event.which === 65) { 
                skyboxRotationLeft = false;
                reflectingObjectRotationLeft = false;
            }
            // right_arrow
            if (event.which === 39) { 
                reflectingObjectRotationRight = false;
            }
            // 'D'
            if (event.which === 68) { 
                skyboxRotationRight = false;
                reflectingObjectRotationRight = false;
            }
            // up_arrow
            if (event.which === 38) { 
                reflectingObjectMoveUp = false;
            }
            // down_arrow
            if (event.which === 40) { 
                reflectingObjectMoveDown = false;
            }
            // 'W'
            if (event.which === 87) { 
                skyboxMoveUp = false;
                reflectingObjectMoveUp = false;
            }
            // 'S'
            if (event.which === 83) { 
                skyboxMoveDown = false;
                reflectingObjectMoveDown = false;
            }
        });

    });
}

/*
 * Calculates the per-vertex normal of the reflectingObject model.
 * basic idea from https://stackoverflow.com/questions/6656358/calculating-normals-in-a-triangle-mesh/6661242#6661242
 */
function calculateNormalReflectingObject() {
    var tmpFace = [];
    var tmpFaceNormal = [];
    var tmpVertexNormal = [];
    var vertexNormal = [];

    // Initialize normals
    for (i = 0; i < reflectingObjectVertex.length; i++) {
        tmpVertexNormal.push(0.0);
    }
    // per-face normals
    for (i = 0; i < reflectingObjectFace.length; i += 3) {

        // extract 3 vertex points to form a surface from which to create a normal
        //      first number of each reflectingObjectFace ('f') stores 
        //      index of vertex previously defined in the obj file
        var tmpX = reflectingObjectVertex[(reflectingObjectFace[i] * 3)];
        var tmpY = reflectingObjectVertex[(reflectingObjectFace[i] * 3) + 1];
        var tmpZ = reflectingObjectVertex[(reflectingObjectFace[i] * 3) + 2];
        var v1 = vec3.fromValues(tmpX, tmpY, tmpZ);

        tmpX = reflectingObjectVertex[(reflectingObjectFace[i + 1] * 3)];
        tmpY = reflectingObjectVertex[(reflectingObjectFace[i + 1] * 3) + 1];
        tmpZ = reflectingObjectVertex[(reflectingObjectFace[i + 1] * 3) + 2];
        var v2 = vec3.fromValues(tmpX, tmpY, tmpZ);

        tmpX = reflectingObjectVertex[(reflectingObjectFace[i + 2] * 3)];
        tmpY = reflectingObjectVertex[(reflectingObjectFace[i + 2] * 3) + 1];
        tmpZ = reflectingObjectVertex[(reflectingObjectFace[i + 2] * 3) + 2];
        var v3 = vec3.fromValues(tmpX, tmpY, tmpZ);

        // store this face
        tmpFace.push([(reflectingObjectFace[i] * 3), (reflectingObjectFace[i + 1] * 3), (reflectingObjectFace[i + 2] * 3)]);

        var t1 = vec3.create();
        var t2 = vec3.create();
        var normal = vec3.create();

        // normal calculation as per pg 384 of Angel textbook
        // given vectors (v1,v2,v3)
        vec3.subtract(t1, v2, v1);
        vec3.subtract(t2, v3, v1);
        vec3.cross(normal, t1, t2);
        vec3.normalize(t2, normal); // normalize 'normal' and store into 't2'
        tmpFaceNormal.push(t2);
    }

    // per-vertex normal = normalized of sum of adjacent per-face normal
    for (i = 0; i < tmpFace.length; i++) {
        for (var q = 0; q < 3; q++) {
            tmpVertexNormal[tmpFace[i][q]] += tmpFaceNormal[i][0];
            tmpVertexNormal[tmpFace[i][q] + 1] += tmpFaceNormal[i][1];
            tmpVertexNormal[tmpFace[i][q] + 2] += tmpFaceNormal[i][2];
        }
    }

    // normalize them
    for (i = 0; i < tmpVertexNormal.length; i += 3) {
        t1 = vec3.fromValues(tmpVertexNormal[i], tmpVertexNormal[i + 1], tmpVertexNormal[i + 2]);
        vec3.normalize(t2, t1);
        vertexNormal.push(t2[0]);
        vertexNormal.push(t2[1]);
        vertexNormal.push(t2[2]);
    }

    reflectingObjectNormal = vertexNormal;
}

// sets up cubemap in skybox
function setupSkyBoxCubeMap(files) {

    var images = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image()];
    // positive x
    images[0].onload = function() {
        console.log('Loaded image number: ' + imageLoadCounter);
        imageLoadCounter += 1;
        skyBoxCubeMap = handleTextureLoadedForSkyBox(
            images,
            skyBoxCubeMap,
            imageLoadCounter
        );
    };
    images[0].src = files[0];

    // positive y
    images[1].onload = function() {
        console.log('Loaded image number: ' + imageLoadCounter);
        imageLoadCounter += 1;
        skyBoxCubeMap = handleTextureLoadedForSkyBox(
            images,
            skyBoxCubeMap,
            imageLoadCounter
        );
    };
    images[1].src = files[1];
    
    // positive z
    images[2].onload = function() {
        console.log('Loaded image number: ' + imageLoadCounter);
        imageLoadCounter += 1;
        skyBoxCubeMap = handleTextureLoadedForSkyBox(
            images,
            skyBoxCubeMap,
            imageLoadCounter
        );
    };
    images[2].src = files[2];

    // negative x
    images[3].onload = function() {
        console.log('Loaded image number: ' + imageLoadCounter);
        imageLoadCounter += 1;
        skyBoxCubeMap = handleTextureLoadedForSkyBox(
            images,
            skyBoxCubeMap,
            imageLoadCounter
        );
    };
    images[3].src = files[3];  

    // negative y
    images[4].onload = function() {
        console.log('Loaded image number: ' + imageLoadCounter);
        imageLoadCounter += 1;
        skyBoxCubeMap = handleTextureLoadedForSkyBox(
            images,
            skyBoxCubeMap,
            imageLoadCounter
        );
    };
    images[4].src = files[4]; 

    // negative z
    images[5].onload = function() {
        console.log('Loaded image number: ' + imageLoadCounter);
        imageLoadCounter += 1;
        skyBoxCubeMap = handleTextureLoadedForSkyBox(
            images,
            skyBoxCubeMap,
            imageLoadCounter
        );
    };
    images[5].src = files[5];
}



// Binds image texture into skybox cubemap.
function handleTextureLoadedForSkyBox(image, texture, imgLoadCounter) {
    var skyboxSide = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
    ];

    if (imgLoadCounter === 6) {
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        try {
            for (var cnt = 0; cnt < 6; cnt++) {
                gl.texImage2D(skyboxSide[cnt], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image[cnt]);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            }
        } catch (exception) {
            console.log(exception);
        }
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        return texture;
    }
}

// Binds buffer data and draw the skybox cube.
function drawSkybox() {
    mat4.translate(mvMatrix, mvMatrix, [0, 0.0, -1]);
    mat4.rotateY(mvMatrix, mvMatrix, degToRad(skyboxRotationValue));
    mat4.rotateX(mvMatrix, mvMatrix, degToRad(skyboxMoveValue));

    setTexture(shaderProgramSkybox);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
    gl.vertexAttribPointer(shaderProgramSkybox.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    setMatrixUniforms(shaderProgramSkybox);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyboxFaceBuffer);
    gl.drawElements(gl.TRIANGLES, skyboxFace.length, gl.UNSIGNED_SHORT, 0);

}

// Binds buffer data and draw the reflectingObject.
function drawReflectingObject(newScale) {

    // translate the reflectingObject to the correct position
    mat4.translate(mvMatrix, mvMatrix, [0.35, -0.75, -5]); 
    mat4.rotateY(mvMatrix, mvMatrix, degToRad(reflectingObjectRotationValue));
    mat4.rotateX(mvMatrix, mvMatrix, degToRad(reflectingObjectMoveValue));
    mat4.scale(mvMatrix, mvMatrix, newScale);
    mat3.normalFromMat4(nMatrix, mvMatrix);

    setTexture(shaderProgramReflectingObject);

    gl.bindBuffer(gl.ARRAY_BUFFER, reflectingObjectVertexBuffer);
    gl.vertexAttribPointer(shaderProgramReflectingObject.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, reflectingObjectNormalBuffer);
    gl.vertexAttribPointer(shaderProgramReflectingObject.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

    setMatrixUniforms(shaderProgramReflectingObject);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, reflectingObjectFaceBuffer);
    gl.drawElements(gl.TRIANGLES, reflectingObjectFace.length, gl.UNSIGNED_SHORT, 0);
}


/**
 * This function will load the texture data for shader program.
 *
 * @param {gl.shaderProgram} shaderProgram to load the texture data
 */
function setTexture(shaderProgram) {

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyBoxCubeMap);
    gl.uniform1i(shaderProgram.skyboxSampler, 0);

}
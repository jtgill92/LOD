/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_URL = "https://jtgill92.github.io/LOD/"; // "https://ncsucg4games.github.io/prog2/"; // location of input files
const INPUT_TRIANGLES_URL = INPUT_URL + "triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = INPUT_URL + "spheres.json"; // spheres file loc
const INPUT_ROOMS_URL = INPUT_URL + "rooms.json"; // triangles file loc
const INPUT_BUILDING_URL = INPUT_URL + "building.json"; // triangles file loc
// var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultEye = vec3.fromValues(3.5, 0.5, 3.5);
// var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultCenter = vec3.fromValues(3.5, 0.5, 4.5);
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
//var lightPosition = vec3.fromValues(2,4,-0.5); // default light position
var lightPos1 = vec3.fromValues(3.5, .95, 3.5); // light in room 1
var lightPos2 = vec3.fromValues(3.5, .95, 9.5); // light in room 2
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* input model data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var triSetSizes = []; // this contains the size of each triangle set
var inputSpheres = []; // the sphere data as loaded from input files
var numSpheres = 0; // how many spheres in the input scene
var inputRooms = []; // the rooms data as loaded from input files
var triRenderables = []; // all triangles in the scene
var inputPortals = []; // all portals in the scene


/* model data prepared for webgl */
var vertexBuffers = []; // vertex coordinate lists by set, in triples
var normalBuffers = []; // normal component lists by set, in triples
var uvBuffers = []; // uv coord lists by set, in duples
var triangleBuffers = []; // indices into vertexBuffers by set, in triples
var textures = []; // texture imagery by set

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; // where to put normal for vertex shader
var vUVAttribLoc; // where to put UV for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var usingTextureULoc; // where to put using texture boolean for fragment shader
var textureULoc; // where to put texture for fragment shader
var eyePositionULoc; // where to put eye postion for pixel shader
var depthModeULoc; // where to put depth mode boolean for fragment shader
var orthoULoc; // where to put ortho projection boolean for fragment shader
var funModeULoc; // where to put fun mode boolean for fragment shader

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space
var viewDelta = 0; // how much to displace view with each key press

/* GUI Elements */
var trisElement;
var timeElement;

var trisNode;
var timeNode;

var initialTime = 0;
var elapsedTime;
var previousTimes = [];
var avgTime;

/* LOD variables */
var LODMode = 1;
var prevLOD = 1;
var auto = false;
var switchMode = 1;
var depthMode = false;
var ortho = false;
var sizeULoc;
var resULoc;
var tris;
var texture = null;
var renderbuffer = null;
var framebuffer = null;
var funMode = false;

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// does stuff when keys are pressed
function handleKeyDown(event) {
    
    const modelEnum = {TRIANGLES: "triangles", SPHERE: "sphere"}; // enumerated model type
    const dirEnum = {NEGATIVE: -1, POSITIVE: 1}; // enumerated rotation direction
    
    function highlightModel(modelType,whichModel) {
        if (handleKeyDown.modelOn != null)
            handleKeyDown.modelOn.on = false;
        handleKeyDown.whichOn = whichModel;
        if (modelType == modelEnum.TRIANGLES)
            handleKeyDown.modelOn = inputTriangles[whichModel]; 
        else
            handleKeyDown.modelOn = inputSpheres[whichModel]; 
        handleKeyDown.modelOn.on = true; 
    } // end highlight model
    
    function translateModel(offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(handleKeyDown.modelOn.translation,handleKeyDown.modelOn.translation,offset);
    } // end translate model

    function rotateModel(axis,direction) {
        if (handleKeyDown.modelOn != null) {
            var newRotation = mat4.create();

            mat4.fromRotation(newRotation,direction*rotateTheta,axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis,handleKeyDown.modelOn.xAxis,newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis,handleKeyDown.modelOn.yAxis,newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model
    
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector
    
    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    switch (event.code) {

        // LOD
        case "Digit1": // original model
            LODMode = 1;
            break;
        case "Digit2": // high res voxel
            LODMode = 2;
            break;
        case "Digit3": // low res voxel
            LODMode = 3;
            break;
        case "Digit0": // use depth buffer
            depthMode = !depthMode;
            if (funMode) {funMode = false;}
            break;
        case "Digit9": // use depth buffer
            funMode = !funMode;
            if (depthMode) {depthMode = false;}
            break;
        case "KeyB": // use depth buffer
            if (switchMode == 1) {switchMode = 2;}
            else {switchMode = 1;}
            console.log(switchMode);
            break;
        
        // model selection
        case "Space": 
            /*if (handleKeyDown.modelOn != null)
                handleKeyDown.modelOn.on = false; // turn off highlighted model
            handleKeyDown.modelOn = null; // no highlighted model
            handleKeyDown.whichOn = -1; // nothing highlighted*/
            auto = !auto;
            console.log(auto);
            break;
        case "ArrowRight": // select next triangle set
            highlightModel(modelEnum.TRIANGLES,(handleKeyDown.whichOn+1) % numTriangleSets);
            break;
        case "ArrowLeft": // select previous triangle set
            highlightModel(modelEnum.TRIANGLES,(handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn-1 : numTriangleSets-1);
            break;
        case "ArrowUp": // select next sphere
            highlightModel(modelEnum.SPHERE,(handleKeyDown.whichOn+1) % numSpheres);
            break;
        case "ArrowDown": // select previous sphere
            highlightModel(modelEnum.SPHERE,(handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn-1 : numSpheres-1);
            break;
            
        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,viewDelta));
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,-viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,-viewDelta));
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,viewDelta));
            } // end if shift not pressed
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,-viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
            } // end if shift not pressed
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up,vec3.add(Up,Up,vec3.scale(temp,viewRight,viewDelta)));
            else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,Up,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
            } // end if shift not pressed
            break;
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye,defaultEye);
            Center = vec3.copy(Center,defaultCenter);
            Up = vec3.copy(Up,defaultUp);
            break;
            
        // model transformation
        case "KeyK": // translate left, rotate left with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,viewRight,viewDelta));
            break;
        case "Semicolon": // translate right, rotate right with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "KeyL": // translate backward, rotate up with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,lookAt,-viewDelta));
            break;
        case "KeyO": // translate forward, rotate down with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,lookAt,viewDelta));
            break;
        case "KeyI": // translate up, rotate counterclockwise with shift 
            if (event.getModifierState("Shift"))
                rotateModel(lookAt,dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp,Up,viewDelta));
            break;
        case "KeyP": // translate down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                rotateModel(lookAt,dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp,Up,-viewDelta));
            break;
        case "Backspace": // reset model transforms to default
            for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
                vec3.set(inputTriangles[whichTriSet].translation,0,0,0);
                vec3.set(inputTriangles[whichTriSet].xAxis,1,0,0);
                vec3.set(inputTriangles[whichTriSet].yAxis,0,1,0);
            } // end for all triangle sets
            for (var whichSphere=0; whichSphere<numSpheres; whichSphere++) {
                vec3.set(inputSpheres[whichSphere].translation,0,0,0);
                vec3.set(inputSpheres[whichSphere].xAxis,1,0,0);
                vec3.set(inputSpheres[whichSphere].yAxis,0,1,0);
            } // end for all spheres
            break;
    } // end switch
} // end handleKeyDown

// set up the webGL environment
function setupWebGL() {
    
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed

    // create a webgl canvas and set it up
    var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
    gl = webGLCanvas.getContext("experimental-webgl"/*"webgl"*/, {preserveDrawingBuffer: true}); // get a webgl object from it

    /* GUI Elements */
    // look up the elements we want to affect
    trisElement = document.getElementById("tris");
    timeElement = document.getElementById("time");
 
    // Create text nodes to save some time for the browser.
    trisNode = document.createTextNode("");
    timeNode = document.createTextNode("");
 
    // Add those text nodes where they need to go
    trisElement.appendChild(trisNode);
    timeElement.appendChild(timeNode);

    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL


// read models in, load them into webgl buffers
function loadModels2() {
    
    // load a texture for the current set or sphere
    function loadTexture(whichModel,currModel,textureFile) {
        
        // load a 1x1 gray image into texture for use when no texture, and until texture loads
        textures[whichModel] = gl.createTexture(); // new texture struct for model
        var currTexture = textures[whichModel]; // shorthand
        gl.bindTexture(gl.TEXTURE_2D, currTexture); // activate model's texture
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // invert vertical texcoord v, load gray 1x1
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,new Uint8Array([64, 64, 64, 255]));        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // invert vertical texcoord v
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); // use linear filter for magnification
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); // use mipmap for minification
        gl.generateMipmap(gl.TEXTURE_2D); // construct mipmap pyramid
        gl.bindTexture(gl.TEXTURE_2D, null); // deactivate model's texture
        
        // if there is a texture to load, asynchronously load it
        if (textureFile != false) {
            currTexture.image = new Image(); // new image struct for texture
            currTexture.image.onload = function () { // when texture image loaded...
                gl.bindTexture(gl.TEXTURE_2D, currTexture); // activate model's new texture
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currTexture.image); // norm 2D texture
                gl.generateMipmap(gl.TEXTURE_2D); // rebuild mipmap pyramid
                gl.bindTexture(gl.TEXTURE_2D, null); // deactivate model's new texture
            } // end when texture image loaded
            currTexture.image.onerror = function () { // when texture image load fails...
                console.log("Unable to load texture " + textureFile); 
            } // end when texture image load fails
            currTexture.image.crossOrigin = "Anonymous"; // allow cross origin load, please
            currTexture.image.src = INPUT_URL + textureFile; // set image location
        } // end if material has a texture
    } // end load texture
    
    inputTriangles = getJSONFile(INPUT_BUILDING_URL,"building"); // read in the triangle data
    var otherTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles"); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var currSet; // the current triangle set
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the vertices array
            var normToAdd; // vtx normal to add to the normal array
            var uvToAdd; // uv coords to add to the uv arry
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner

            var meshes = inputTriangles.meshes;
        
            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.meshes.length; // remember how many tri sets
            for (var whichSet=0; whichSet<meshes.length; whichSet++) { // for each tri set
                currSet = meshes[whichSet];
                
                // set up hilighting, modeling translation and rotation
                currSet.center = vec3.fromValues(0,0,0);  // center point of tri set
                currSet.on = false; // not highlighted
                currSet.translation = vec3.fromValues(0,0,0); // no translation
                currSet.xAxis = vec3.fromValues(1,0,0); // model X axis
                currSet.yAxis = vec3.fromValues(0,1,0); // model Y axis 

                // set up the vertex, normal and uv arrays, define model center and axes
                currSet.glVertices = []; // flat coord list for webgl
                currSet.glNormals = []; // flat normal list for webgl
                currSet.glUvs = []; // flat texture coord list for webgl
                var numVerts = currSet.vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = currSet.vertices[whichSetVert]; // get vertex to add
                    normToAdd = currSet.normals[whichSetVert]; // get normal to add
                    uvToAdd1 = currSet.texturecoords[0][whichSetVert]; // get uv to add
                    uvToAdd2 = currSet.texturecoords[0][whichSetVert+1];
                    currSet.glVertices.push(vtxToAdd/*[0],vtxToAdd[1],vtxToAdd[2]*/); // put coords in set vertex list
                    currSet.glNormals.push(normToAdd/*[0],normToAdd[1],normToAdd[2]*/); // put normal in set normal list
                    currSet.glUvs.push(uvToAdd1, uvToAdd2/*[0],uvToAdd[1]*/); // put uv in set uv list
                    if (whichSetVert%3 == 0) {
                        var v = currSet.vertices;
                        var vtxToAdd2 = [v[whichSetVert],v[whichSetVert+1],v[whichSetVert+2]];
                        vec3.max(maxCorner,maxCorner,vtxToAdd2); // update world bounding box corner maxima
                        vec3.min(minCorner,minCorner,vtxToAdd2); // update world bounding box corner minima
                        vec3.add(currSet.center,currSet.center,vtxToAdd2); // add to ctr sum
                    }
                } // end for vertices in set
                vec3.scale(currSet.center,currSet.center,1/numVerts); // avg ctr sum

                var dist1 = vec3.distance(currSet.center,minCorner);
                var dist2 = vec3.distance(currSet.center,maxCorner);

                currSet.dist = Math.max(dist1,dist2);
                currSet.minCorner = minCorner;
                currSet.maxCorner = maxCorner;

                viewDelta = .1;//vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global

                // send the vertex coords, normals and uvs to webGL; load texture
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(currSet.glVertices),gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(currSet.glNormals),gl.STATIC_DRAW); // data in
                uvBuffers[whichSet] = gl.createBuffer(); // init empty webgl set uv coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(currSet.glUvs),gl.STATIC_DRAW); // data in

                currSet.material = otherTriangles[2].material;

                loadTexture(whichSet,currSet,currSet.material.texture); // load tri set's texture

                // set up the triangle index array, adjusting indices across sets
                currSet.glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = currSet.faces.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = currSet.faces[whichSetTri]; // get tri to add
                    currSet.glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(currSet.glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 
        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        attribute vec2 aVertexUV; // vertex texture uv
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader
        varying vec2 vVertexUV; // interpolated uv for frag shader

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 
            
            // vertex uv
            vVertexUV = aVertexUV;
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        // uniform vec3 uLightPosition; // the light's position
        uniform vec3 uLightPos1; // light1's position
        uniform vec3 uLightPos2; // light2's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        
        // texture properties
        uniform bool uUsingTexture; // if we are using a texture
        uniform sampler2D uTexture; // the texture for the fragment
        varying vec2 vVertexUV; // texture uv of fragment
            
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment

        // depthMode
        uniform bool uDepthMode;
        uniform bool uFunMode;
        uniform bool uOrtho;
        uniform float uSize;
        uniform float uRes;
        
        void main(void) {
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term 1
            vec3 normal1 = normalize(vVertexNormal); 
            vec3 light1 = normalize(uLightPos1 - vWorldPos);
            float lambert1 = max(0.0,dot(normal1,light1));
            vec3 diffuse1 = uDiffuse*uLightDiffuse*lambert1; // diffuse term
            
            // specular term 1
            vec3 eye1 = normalize(uEyePosition - vWorldPos);
            vec3 halfVec1 = normalize(light1+eye1);
            float highlight1 = pow(max(0.0,dot(normal1,halfVec1)),uShininess);
            vec3 specular1 = uSpecular*uLightSpecular*highlight1; // specular term

            // denom 1
            float denom1 = min(1.0, pow(length(uLightPos1 - vWorldPos), 2.0)); // looks awesome
            // float denom1 = pow(length(uLightPos1 - vWorldPos + 1.0), 2.0);

            // diffuse term 2
            vec3 normal2 = normalize(vVertexNormal); 
            vec3 light2 = normalize(uLightPos2 - vWorldPos);
            float lambert2 = max(0.0,dot(normal2,light2));
            vec3 diffuse2 = uDiffuse*uLightDiffuse*lambert2; // diffuse term
            
            // specular term 2
            vec3 eye2 = normalize(uEyePosition - vWorldPos);
            vec3 halfVec2 = normalize(light2+eye2);
            float highlight2 = pow(max(0.0,dot(normal2,halfVec2)),uShininess);
            vec3 specular2 = uSpecular*uLightSpecular*highlight2; // specular term

            // denom 2
            float denom2 = min(1.0, pow(length(uLightPos2 - vWorldPos), 2.0));
            
            // combine to find lit color
            vec3 litColor = ambient + (diffuse1 + specular1)/denom1 + (diffuse2 + specular2)/denom2; 
            if (uFunMode) { // render good times
                // linearize
                float f = 100.0; //far plane
                float n = 0.1; //near plane
                float z = 0.0;

                z = (2.0 * n) / (f + n - gl_FragCoord.z * (f - n)); 

                // convert to 0..(res-1) aka "discretize"
                float res = uRes; //256.0;
                float d = uSize; //25.0;

                float d2 = (d-n)/(f-n);

                //z = ((res - 1.0)/d2)*z;
                //z = round(z); // doesn't work; not supported at this time?
                //z = floor(z + 0.5);

                z = z*100.0; //fun (goes well with //neat)

                gl_FragColor = vec4(sin(z*2.0*3.14),cos(z*2.0*3.14),z,1.0); //neat
            }
            else if (uDepthMode) { // render depth map
                // linearize
                float f = 100.0; //far plane
                float n = 0.1; //near plane
                float z = 0.0; 

                if(uOrtho) {
                    z = gl_FragCoord.z;
                } else {
                    z = (2.0 * n) / (f + n - gl_FragCoord.z * (f - n));
                }

                // convert to 0..(res-1) aka "discretize"
                float res = uRes; //256.0;
                float d = uSize; //25.0;

                float d2 = (d-n)/(f-n);

                z = ((res - 1.0)/d2)*z;
                //z = round(z); // doesn't work; not supported at this time?
                z = floor(z + 0.5);

                //z = z*100.0; //fun (goes well with //neat)

                //gl_FragColor = vec4(10.0*z,10.0*z,10.0*z,1.0); //for demo
                //gl_FragColor = vec4(sin(z*2.0*3.14),cos(z*2.0*3.14),z,1.0); //neat
                //gl_FragColor = vec4(z,z,z,1.0);
                gl_FragColor = vec4(z/(res-1.0),z/(res-1.0),z/(res-1.0),1.0);
                //gl_FragColor = vec4(255,1,1,1);
            }
            else if (!uUsingTexture) {
                gl_FragColor = vec4(litColor, 1.0);
            } else {
                vec4 texColor = texture2D(uTexture, vec2(vVertexUV.s, vVertexUV.t));
            
                // gl_FragColor = vec4(texColor.rgb * litColor, texColor.a);
                gl_FragColor = vec4(texColor.rgb * litColor, 1.0);
            } // end if using texture
        } // end main
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                vUVAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexUV"); // ptr to vertex UV attrib
                gl.enableVertexAttribArray(vUVAttribLoc); // connect attrib to array
                
                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat
                
                // locate fragment uniforms
                eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                // var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                var lightPos1ULoc = gl.getUniformLocation(shaderProgram, "uLightPos1");
                var lightPos2ULoc = gl.getUniformLocation(shaderProgram, "uLightPos2");
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
                usingTextureULoc = gl.getUniformLocation(shaderProgram, "uUsingTexture"); // ptr to using texture
                textureULoc = gl.getUniformLocation(shaderProgram, "uTexture"); // ptr to texture
                depthModeULoc = gl.getUniformLocation(shaderProgram, "uDepthMode"); // ptr to depth mode
                orthoULoc = gl.getUniformLocation(shaderProgram, "uOrtho"); // ptr to ortho mode
                funModeULoc = gl.getUniformLocation(shaderProgram, "uFunMode"); // ptr to depth mode
                
                // pass global (not per model) constants into fragment uniforms
                // gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position // causes static eye pos calculations
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                //gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
                gl.uniform3fv(lightPos1ULoc,lightPos1); // pass in light1's position
                gl.uniform3fv(lightPos2ULoc,lightPos2); // pass in light2's position

                //LOD
                sizeULoc = gl.getUniformLocation(shaderProgram, "uSize"); // ptr to size
                resULoc = gl.getUniformLocation(shaderProgram, "uRes"); // ptr to res
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

function createBuffer(res) {
    // create texture for color
    var width = res;
    var height = res;
    /*var*/ texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
    gl.RGBA, gl.UNSIGNED_BYTE, null);

    // create Renderbuffer for depth
    /*var*/ renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
    width, height);

    // create framebuffer for offscreen rendering
    /*var*/ framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

    // clean up
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

}

// render to offsceen framebuffer
function renderOffscreen(eye, center, up, res, size) {
    //setup camera

    //update size and res uniforms
    gl.uniform1f(sizeULoc,size);
    gl.uniform1f(resULoc,res);

    //render loop
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCenter = vec3.create();

        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        vec3.negate(negCenter,currModel.center);
        mat4.multiply(sumRotation,sumRotation,mat4.fromTranslation(temp,negCenter)); // rotate * -translate
        mat4.multiply(sumRotation,mat4.fromTranslation(temp,currModel.center),sumRotation); // translate * rotate * -translate
        mat4.fromTranslation(mMatrix,currModel.translation); // translate in model matrix
        mat4.multiply(mMatrix,mMatrix,sumRotation); // rotate in model matrix
    } // end make model transform
    
    var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var hpvMatrix = mat4.create(); // hand * proj * view matrices
    var hpvmMatrix = mat4.create(); // hand * proj * view * model matrices
    const HIGHLIGHTMATERIAL = 
        {ambient:[0.5,0.5,0], diffuse:[0.5,0.5,0], specular:[0,0,0], n:1, alpha:1, texture:false}; // hlht mat
    
    //gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    //window.requestAnimationFrame(renderOffscreen);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up handedness, projection and view
    mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    //mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,100); // create projection matrix
    var left = -size/2.0;
    var right = size/2.0;
    var bottom = -size/2.0;
    var top = size/2.0;
    mat4.ortho(pMatrix,left,right,bottom,top,0.1,100); // create projection matrix
    //mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.lookAt(vMatrix,eye,center,up); // create view matrix
    mat4.multiply(hpvMatrix,hMatrix,pMatrix); // handedness * projection
    mat4.multiply(hpvMatrix,hpvMatrix,vMatrix); // handedness * projection * view

    gl.uniform3fv(eyePositionULoc,Eye); // update eye position

    gl.uniform1i(depthModeULoc,true);
    gl.uniform1i(orthoULoc,true);
    //gl.uniform1i(depthModeULoc,false);
    //gl.uniform1i(depthModeULoc,depthMode);
    //gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // render each triangle set
    var currSet, setMaterial; // the tri set and its material properties
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        currSet = inputTriangles.meshes[whichTriSet];
        
        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // handedness * project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, hpvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        if (inputTriangles.meshes[whichTriSet].on)
            setMaterial = HIGHLIGHTMATERIAL; // highlight material
        else
            setMaterial = currSet.material; // normal material
        gl.uniform3fv(ambientULoc,setMaterial.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,setMaterial.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,setMaterial.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,setMaterial.n); // pass in the specular exponent
        gl.uniform1i(usingTextureULoc,(currSet.material.texture != false)); // whether the set uses texture
        gl.activeTexture(gl.TEXTURE0); // bind to active texture 0 (the first)
        gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]); // bind the set's texture
        gl.uniform1i(textureULoc, 0); // pass in the texture and active texture 0
        
        // position, normal and uv buffers: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate position
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate normal
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichTriSet]); // activate uv
        gl.vertexAttribPointer(vUVAttribLoc,2,gl.FLOAT,false,0,0); // feed

        // off-screen rendering
        //gl.bindTexture(gl.TEXTURE_2D, texture);
        //gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        //gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
     
        //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } // end for each triangle set
}

/*Remember to switch back to rendering offscreen when
  finished debugging!*/

// make cube at [i,j,k] + center
function makeVoxel(out,i,j,k,res,size,objCenter,vMap) {
    // Do something
    //console.log("makeVoxel");

    //if (vMap[i][j][k] != true) {
    //    vMap[i][j][k] == true;

        // voxel center
        //var c = [i+objCenter[0],j+objCenter[1],k+objCenter[2]];

        // voxel side length
        var L = size/res;

        // half length
        var l = L/2.0;

        // voxel center
        var c = [i*L+objCenter[0]+l,j*L+objCenter[1]+l,k*L+objCenter[2]+l];

        // manual adjustment(fix asap(shouldn't need to adjust it manually))
        //c = [c[0]-20,c[1]-20,c[2]-20];
        c = [c[0]-size/2,c[1]-size/2,c[2]-size/2];

        //8 vertices
        var verts = [];
        verts[0] = [c[0] - l, c[1] - l, c[2] - l];
        verts[1] = [c[0] + l, c[1] - l, c[2] - l];
        verts[2] = [c[0] - l, c[1] + l, c[2] - l];
        verts[3] = [c[0] + l, c[1] + l, c[2] - l];
        verts[4] = [c[0] - l, c[1] - l, c[2] + l];
        verts[5] = [c[0] + l, c[1] - l, c[2] + l];
        verts[6] = [c[0] - l, c[1] + l, c[2] + l];
        verts[7] = [c[0] + l, c[1] + l, c[2] + l];

        var normals = [];
        normals[0] = [1,0,0];  //cx+d
        normals[1] = [-1,0,0]; //cx-d
        normals[2] = [0,1,0];  //cy+d
        normals[3] = [0,-1,0]; //cy-d
        normals[4] = [0,0,1];  //cz+d
        normals[5] = [0,0,-1]; //cz-d

        var faces = [];
        faces[0] = [3,7,1,5]; //cx+d
        faces[1] = [6,2,4,0]; //cx-d
        faces[2] = [6,7,2,3]; //cy+d
        faces[3] = [5,4,1,0]; //cy-d
        faces[4] = [7,6,5,4]; //cz+d
        faces[5] = [2,3,0,1]; //cz-d

        var uvs = [[0,1],[1,1],[0,0],[1,0]];

        for (var f = 0; f < 6; f++) {

            //add Tris
            var s = out.glVertices.length/3;
            out.glTriangles.push(s+0,s+1,s+2);
            out.glTriangles.push(s+2,s+1,s+3);

            var face = faces[f];
            for (var v = 0; v < 4; v++) {
                // add vertices
                var vtxToAdd = verts[face[v]];
                out.glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);

                //add normals
                var normToAdd = normals[f];
                out.glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]);

                //add UVs
                var uvToAdd = uvs[v];
                out.glUvs.push(uvToAdd[0],uvToAdd[1]);
            }

        }

    //}
}

// Generate models for LOD
function generate() {
    var out = [];
    out[0] = inputTriangles.meshes;

    var center = vec3.fromValues(0.0,0.0,0.0);
    var dist = 0.0;

    out[0].numTris = 0;

    for (var t = 0; t < inputTriangles.meshes.length; t++) {
        vec3.add(center, center, inputTriangles.meshes[t].center);
        var x = inputTriangles.meshes[t].dist;
        dist = Math.max(dist,x);
        out[0][t].vbo = vertexBuffers[t];
        out[0][t].nbo = normalBuffers[t];
        out[0][t].uvbo = uvBuffers[t];
        out[0][t].tbo = triangleBuffers[t];
        out[0][t].texture = textures[t];
        out[0].numTris += out[0][t].glTriangles.length/3;
    }
    vec3.scale(center, center, 1/inputTriangles.meshes.length);
    var size = dist*2.0;
    out[0].size = size;
    //console.log(size);

    for (var n = 1; n < 3; n++) {
        var res = 32.0/n; // 32 by 32 voxel resolution
        var lod = n; // voxel detail level

        var d = size/2.0;
        var eye;
        var up;
        /*var texture = gl.createTexture();
        var renderbuffer = gl.createRenderbuffer();
        var framebuffer = gl.createFramebuffer();*/
        createBuffer(res);
        //createBuffer(512);
        var vMap = [];

        //don't forget to handle material, texture, etc!!!!!!!!!!
        out[lod] = [];
        out[lod][0] = [];
        out[lod][0].glTriangles = [];
        out[lod][0].glVertices = [];
        out[lod][0].glNormals = [];
        out[lod][0].glUvs = [];
        out[lod][0].material = out[0][0].material;
        out[lod][0].xAxis = out[0][0].xAxis;
        out[lod][0].yAxis = out[0][0].yAxis;
        out[lod][0].translation = out[0][0].translation;
        out[lod][0].center = center;
        out[lod][0].on = out[0][0].on;
        out[lod][0].texture = out[0][0].texture;
        out[lod].size = out[0].size;


        //Note: coor system fixed

        // side: (cx+d)
        eye = vec3.fromValues(center[0]+d,center[1],center[2]);
        up = vec3.fromValues(0,1,0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.viewport(0, 0, res, res);
        renderOffscreen(eye, center, up, res, size); // should size be a parameter?
        for (var j = 0; j < res; j++) {
            for (var i = 0; i < res; i++) {
                //read one pixel
                var readout = new Uint8Array(1 * 1 * 4);

                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                
                //renderOffscreen(eye, center, up, res, size);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.viewport(0, 0, res, res);
                gl.readPixels(i,j,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readout);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, 512, 512);
                //console.log(readout);

                var k = readout[0];
                //console.log(k);
                if (k != 0.0) {
                k = (k/255)*(res-1.0) // scale back up to (0..res-1)
                k = Math.floor(k+0.5);
                //console.log(k);

                // find coor of voxel
                var x = (res-1)-k;
                var y = j;
                var z = i;

                makeVoxel(out[lod][0],x,y,z,res,size,center,vMap);}
            }
        }

        // side: (cx-d)
        eye = vec3.fromValues(center[0]-d,center[1],center[2]);
        up = vec3.fromValues(0,1,0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.viewport(0, 0, res, res);
        renderOffscreen(eye, center, up, res, size); // should size be a parameter?
        for (var j = 0; j < res; j++) {
            for (var i = 0; i < res; i++) {
                //read one pixel
                var readout = new Uint8Array(1 * 1 * 4);

                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                
                //renderOffscreen(eye, center, up, res, size);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.viewport(0, 0, res, res);
                gl.readPixels(i,j,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readout);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, 512, 512);

                var k = readout[0];
                //console.log(k);
                if (k != 0.0) {
                k = (k/255)*(res-1.0) // scale back up to (0..res-1)
                k = Math.floor(k+0.5);

                // find coor of voxel
                var x = k;
                var y = j;
                var z = (res-1)-i;

                makeVoxel(out[lod][0],x,y,z,res,size,center,vMap);}
            }
        }

        // side: (cy+d)
        eye = vec3.fromValues(center[0],center[1]+d,center[2]);
        up = vec3.fromValues(0,0,1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.viewport(0, 0, res, res);
        renderOffscreen(eye, center, up, res, size); // should size be a parameter?
        for (var j = 0; j < res; j++) {
            for (var i = 0; i < res; i++) {
                //read one pixel
                var readout = new Uint8Array(1 * 1 * 4);

                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                
                //renderOffscreen(eye, center, up, res, size);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.viewport(0, 0, res, res);
                gl.readPixels(i,j,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readout);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, 512, 512);

                var k = readout[0];
                //console.log(k);
                if (k != 0.0) {
                k = (k/255)*(res-1.0) // scale back up to (0..res-1)
                k = Math.floor(k+0.5);

                // find coor of voxel
                var x = i;
                var y = (res-1)-k;
                var z = j;

                makeVoxel(out[lod][0],x,y,z,res,size,center,vMap);}
            }
        }

        // side: (cy-d)
        eye = vec3.fromValues(center[0],center[1]-d,center[2]);
        up = vec3.fromValues(0,0,1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.viewport(0, 0, res, res);
        renderOffscreen(eye, center, up, res, size); // should size be a parameter?
        for (var j = 0; j < res; j++) {
            for (var i = 0; i < res; i++) {
                //read one pixel
                var readout = new Uint8Array(1 * 1 * 4);

                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                
                //renderOffscreen(eye, center, up, res, size);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.viewport(0, 0, res, res);
                gl.readPixels(i,j,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readout);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, 512, 512);

                var k = readout[0];
                //console.log(k);
                if (k != 0.0) {
                k = (k/255)*(res-1.0) // scale back up to (0..res-1)
                k = Math.floor(k+0.5);

                // find coor of voxel
                var x = (res-1)-i;
                var y = k;
                var z = j;

                makeVoxel(out[lod][0],x,y,z,res,size,center,vMap);}
            }
        }

        // side: (cz+d)
        eye = vec3.fromValues(center[0],center[1],center[2]+d);
        up = vec3.fromValues(0,1,0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.viewport(0, 0, res, res);
        renderOffscreen(eye, center, up, res, size); // should size be a parameter?
        for (var j = 0; j < res; j++) {
            for (var i = 0; i < res; i++) {
                //read one pixel
                var readout = new Uint8Array(1 * 1 * 4);

                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                
                //renderOffscreen(eye, center, up, res, size);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.viewport(0, 0, res, res);
                gl.readPixels(i,j,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readout);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, 512, 512);

                var k = readout[0];
                //console.log(k);
                if (k != 0.0) {
                k = (k/255)*(res-1.0) // scale back up to (0..res-1)
                k = Math.floor(k+0.5);

                // find coor of voxel
                var x = (res-1)-i;
                var y = j;
                var z = (res-1)-k;

                makeVoxel(out[lod][0],x,y,z,res,size,center,vMap);}
            }
        }

        // side: (cz-d)
        eye = vec3.fromValues(center[0],center[1],center[2]-d);
        up = vec3.fromValues(0,1,0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.viewport(0, 0, res, res);
        renderOffscreen(eye, center, up, res, size); // should size be a parameter?
        for (var j = 0; j < res; j++) {
            for (var i = 0; i < res; i++) {
                //read one pixel
                var readout = new Uint8Array(1 * 1 * 4);

                gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
                
                //renderOffscreen(eye, center, up, res, size);
                //gl.bindTexture(gl.TEXTURE_2D, texture);
                //gl.viewport(0, 0, res, res);
                gl.readPixels(i,j,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readout);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, 512, 512);

                var k = readout[0];
                //console.log(k);
                if (k != 0.0) {
                k = (k/255)*(res-1.0) // scale back up to (0..res-1)
                k = Math.floor(k+0.5);

                // find coor of voxel
                var x = i;
                var y = j;
                var z = k;

                makeVoxel(out[lod][0],x,y,z,res,size,center,vMap);}
            }
        }

        // send the vertex coords, normals and uvs to webGL; load texture
        out[lod][0].vbo = gl.createBuffer(); // init empty webgl set vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,out[lod][0].vbo); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out[lod][0].glVertices),gl.STATIC_DRAW); // data in
        out[lod][0].nbo = gl.createBuffer(); // init empty webgl set normal component buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,out[lod][0].nbo); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out[lod][0].glNormals),gl.STATIC_DRAW); // data in
        out[lod][0].uvbo = gl.createBuffer(); // init empty webgl set uv coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,out[lod][0].uvbo); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out[lod][0].glUvs),gl.STATIC_DRAW); // data in

        // send the triangle indices to webGL
        out[lod][0].tbo = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,out[lod][0].tbo); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(out[lod][0].glTriangles),gl.STATIC_DRAW); // data in

        out[lod].numTris = out[lod][0].glTriangles.length/3;
    }

    tris = out;
}

function switching() {
    // Range-based
    if (switchMode == 1) {
        var c = tris[1][0].center;
        var e = Eye;

        var d = vec3.dist(c,e);
        var s = tris[0].size;
        if (d < s) {
            LODMode = 1;
        } else if (d < 2*s) {
            LODMode = 2;
        } else { // (d >= 4*s)
            LODMode = 3;
        }
    } else if (switchMode == 2) { //Projected screen area
        var c = tris[1][0].center;
        var v = Eye;

        var n = 0.1;

        var r = tris[0].size/2;

        VMinusC = vec3.fromValues(0,0,0);
        vec3.subtract(VMinusC, v, c);

        var d = vec3.fromValues(0,0,0);
        vec3.subtract(d,Center,v);
        vec3.normalize(d,d);

        var denom = vec3.dot(d,VMinusC);

        var p = n*r/denom;

        var A = Math.PI*p*p*512*512;
        //console.log(A);

        var EPSILON1 = .05*40*40;
        var EPSILON2 = .05*80*80;

        if (A < 40*40 - EPSILON1 && LODMode == 2) {
            LODMode = 3;
        } else if (A > 40*40 + EPSILON1 && LODMode == 3) {
            LODMode = 2;
        }else if (A < 80*80 - EPSILON2 && LODMode == 1) {
            LODMode = 2;
        } else if (A > 80*80 + EPSILON2 && LODMode == 2){
            LODMode = 1;
        }
    }
}

// render the loaded model
function renderModels() {
    
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCenter = vec3.create();

        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        vec3.negate(negCenter,currModel.center);
        mat4.multiply(sumRotation,sumRotation,mat4.fromTranslation(temp,negCenter)); // rotate * -translate
        mat4.multiply(sumRotation,mat4.fromTranslation(temp,currModel.center),sumRotation); // translate * rotate * -translate
        mat4.fromTranslation(mMatrix,currModel.translation); // translate in model matrix
        mat4.multiply(mMatrix,mMatrix,sumRotation); // rotate in model matrix
    } // end make model transform
    
    var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var hpvMatrix = mat4.create(); // hand * proj * view matrices
    var hpvmMatrix = mat4.create(); // hand * proj * view * model matrices
    const HIGHLIGHTMATERIAL = 
        {ambient:[0.5,0.5,0], diffuse:[0.5,0.5,0], specular:[0,0,0], n:1, alpha:1, texture:false}; // hlht mat

    window.requestAnimationFrame(renderModels); // set up frame render callback
    
    gl.clearColor(1, 1, 1, 1);   // clear to white
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up handedness, projection and view
    mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,100); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(hpvMatrix,hMatrix,pMatrix); // handedness * projection
    mat4.multiply(hpvMatrix,hpvMatrix,vMatrix); // handedness * projection * view

    gl.uniform3fv(eyePositionULoc,Eye); // update eye position

    /* perform desired LOD */
    var lod = LODMode - 1;

    gl.uniform1i(depthModeULoc,depthMode);
    gl.uniform1i(funModeULoc,funMode);
    gl.uniform1i(orthoULoc,false);

    if (auto) {
        switching();
    }

    // render each triangle
    var currSet = tris[lod], triMaterial; // the tri set and its material properties
    for (var t=0; t<tris[lod].length; t++) {
        
        // make model transform, add to view project
        makeModelTransform(currSet[t]);
        mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // handedness * project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, hpvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        if (currSet[t].on/*inputTriangles[currSet.whichSet].on*/)
            setMaterial = HIGHLIGHTMATERIAL; // highlight material
        else
            setMaterial = currSet[t].material; // normal material
        gl.uniform3fv(ambientULoc,setMaterial.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,setMaterial.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,setMaterial.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,setMaterial.n); // pass in the specular exponent
        gl.uniform1i(usingTextureULoc,(currSet[t].material.texture != false)); // whether the set uses texture
        gl.activeTexture(gl.TEXTURE0); // bind to active texture 0 (the first)
        gl.bindTexture(gl.TEXTURE_2D, currSet[t].texture/*textures[currSet.whichSet]*/); // bind the set's texture
        gl.uniform1i(textureULoc, 0); // pass in the texture and active texture 0
        
        // position, normal and uv buffers: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,currSet[t].vbo); // vertexBuffers[currTri.whichSet]); // activate position
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,currSet[t].nbo); // normalBuffers[currTri.whichSet]); // activate normal
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,currSet[t].uvbo); // uvBuffers[currTri.whichSet]); // activate uv
        gl.vertexAttribPointer(vUVAttribLoc,2,gl.FLOAT,false,0,0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,currSet[t].tbo); // activate
        gl.drawElements(gl.TRIANGLES,currSet[t].glTriangles.length,gl.UNSIGNED_SHORT,0); // render
        
    } // end for each triangle set

    /* Update GUI */
    trisNode.nodeValue = tris[lod].numTris;

    elapsedTime = (new Date).getTime() - initialTime;
    initialTime = (new Date).getTime();
    previousTimes.push(elapsedTime);
    if (previousTimes.length > 10) {
        previousTimes.shift();
    }
    avgTime = 0;
    for (var t = 0; t < previousTimes.length; t++) {
        avgTime += previousTimes[t];
    }
    avgTime /= previousTimes.length;

    timeNode.nodeValue = avgTime.toFixed(2);

    /* END Update GUI */

} // end render model


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadModels2();
  setupShaders(); // setup the webGL shaders
  generate();
  renderModels(); // draw the triangles using webGL
  
} // end main

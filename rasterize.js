/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_URL = "https://jtgill92.github.io/Culling/"; // "https://ncsucg4games.github.io/prog2/"; // location of input files
const INPUT_TRIANGLES_URL = INPUT_URL + "triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = INPUT_URL + "spheres.json"; // spheres file loc
const INPUT_ROOMS_URL = INPUT_URL + "rooms.json"; // triangles file loc
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
var eyePositionULo; // where to put eye postion for pixel shader

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

/* culling variables */
var cullMode = 1;

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

        // culling
        case "Digit1": // no culling
            cullMode = 1;
            break;
        case "Digit2": // frustum culling
            cullMode = 2;
            break;
        case "Digit3": // portal culling
            cullMode = 3;
            break;
        
        // model selection
        case "Space": 
            if (handleKeyDown.modelOn != null)
                handleKeyDown.modelOn.on = false; // turn off highlighted model
            handleKeyDown.modelOn = null; // no highlighted model
            handleKeyDown.whichOn = -1; // nothing highlighted
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
    gl = webGLCanvas.getContext("webgl"); // get a webgl object from it

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
function loadModels() {
    
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
    
    // make a sphere with radius 1 at the origin, with numLongSteps longitudes. 
    // Returns verts, tris and normals.
    function makeSphere(numLongSteps) {
        
        try {
            if (numLongSteps % 2 != 0)
                throw "in makeSphere: uneven number of longitude steps!";
            else if (numLongSteps < 4)
                throw "in makeSphere: number of longitude steps too small!";
            else { // good number longitude steps
            
                // make vertices, normals and uvs -- repeat longitude seam
                const INVPI = 1/Math.PI, TWOPI = Math.PI+Math.PI, INV2PI = 1/TWOPI, epsilon=0.001*Math.PI;
                var sphereVertices = [0,-1,0]; // vertices to return, init to south pole
                var sphereUvs = [0.5,0]; // uvs to return, bottom texture row collapsed to one texel
                var angleIncr = TWOPI / numLongSteps; // angular increment 
                var latLimitAngle = angleIncr * (Math.floor(numLongSteps*0.25)-1); // start/end lat angle
                var latRadius, latY, latV; // radius, Y and texture V at current latitude
                for (var latAngle=-latLimitAngle; latAngle<=latLimitAngle+epsilon; latAngle+=angleIncr) {
                    latRadius = Math.cos(latAngle); // radius of current latitude
                    latY = Math.sin(latAngle); // height at current latitude
                    latV = latAngle*INVPI + 0.5; // texture v = (latAngle + 0.5*PI) / PI
                    for (var longAngle=0; longAngle<=TWOPI+epsilon; longAngle+=angleIncr) { // for each long
                        sphereVertices.push(-latRadius*Math.sin(longAngle),latY,latRadius*Math.cos(longAngle));
                        sphereUvs.push(longAngle*INV2PI,latV); // texture u = (longAngle/2PI)
                    } // end for each longitude
                } // end for each latitude
                sphereVertices.push(0,1,0); // add north pole
                sphereUvs.push(0.5,1); // top texture row collapsed to one texel
                var sphereNormals = sphereVertices.slice(); // for this sphere, vertices = normals; return these

                // make triangles, first poles then middle latitudes
                var sphereTriangles = []; // triangles to return
                var numVertices = Math.floor(sphereVertices.length/3); // number of vertices in sphere
                for (var whichLong=1; whichLong<=numLongSteps; whichLong++) { // poles
                    sphereTriangles.push(0,whichLong,whichLong+1);
                    sphereTriangles.push(numVertices-1,numVertices-whichLong-1,numVertices-whichLong-2);
                } // end for each long
                var llVertex; // lower left vertex in the current quad
                for (var whichLat=0; whichLat<(numLongSteps/2 - 2); whichLat++) { // middle lats
                    for (var whichLong=0; whichLong<numLongSteps; whichLong++) {
                        llVertex = whichLat*(numLongSteps+1) + whichLong + 1;
                        sphereTriangles.push(llVertex,llVertex+numLongSteps+1,llVertex+numLongSteps+2);
                        sphereTriangles.push(llVertex,llVertex+numLongSteps+2,llVertex+1);
                    } // end for each longitude
                } // end for each latitude
            } // end if good number longitude steps
            return({vertices:sphereVertices, normals:sphereNormals, uvs:sphereUvs, triangles:sphereTriangles});
        } // end try
        
        catch(e) {
            console.log(e);
        } // end catch
    } // end make sphere
    
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles"); // read in the triangle data

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
        
            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                currSet = inputTriangles[whichSet];
                
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
                    uvToAdd = currSet.uvs[whichSetVert]; // get uv to add
                    currSet.glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set vertex list
                    currSet.glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set normal list
                    currSet.glUvs.push(uvToAdd[0],uvToAdd[1]); // put uv in set uv list
                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(currSet.center,currSet.center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(currSet.center,currSet.center,1/numVerts); // avg ctr sum

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
                loadTexture(whichSet,currSet,currSet.material.texture); // load tri set's texture

                // set up the triangle index array, adjusting indices across sets
                currSet.glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = currSet.triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = currSet.triangles[whichSetTri]; // get tri to add
                    currSet.glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(currSet.glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 
        
            inputSpheres = getJSONFile(INPUT_SPHERES_URL,"spheres"); // read in the sphere data

            if (inputSpheres == String.null)
                throw "Unable to load spheres file!";
            else {
                
                // init sphere highlighting, translation and rotation; update bbox
                var sphere; // current sphere
                var temp = vec3.create(); // an intermediate vec3
                var minXYZ = vec3.create(), maxXYZ = vec3.create();  // min/max xyz from sphere
                numSpheres = inputSpheres.length; // remember how many spheres
                for (var whichSphere=0; whichSphere<numSpheres; whichSphere++) {
                    sphere = inputSpheres[whichSphere];
                    sphere.on = false; // spheres begin without highlight
                    sphere.translation = vec3.fromValues(0,0,0); // spheres begin without translation
                    sphere.xAxis = vec3.fromValues(1,0,0); // sphere X axis
                    sphere.yAxis = vec3.fromValues(0,1,0); // sphere Y axis 
                    sphere.center = vec3.fromValues(0,0,0); // sphere instance is at origin
                    vec3.set(minXYZ,sphere.x-sphere.r,sphere.y-sphere.r,sphere.z-sphere.r); 
                    vec3.set(maxXYZ,sphere.x+sphere.r,sphere.y+sphere.r,sphere.z+sphere.r); 
                    vec3.min(minCorner,minCorner,minXYZ); // update world bbox min corner
                    vec3.max(maxCorner,maxCorner,maxXYZ); // update world bbox max corner
                    loadTexture(numTriangleSets+whichSphere,sphere,sphere.texture); // load the sphere's texture
                } // end for each sphere
                viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global

                // make one sphere instance that will be reused, with 32 longitude steps
                inputSpheres.oneSphere = makeSphere(32);
                var oneSphere = inputSpheres.oneSphere;

                // send the sphere vertex coords and normals to webGL
                vertexBuffers.push(gl.createBuffer()); // init empty webgl sphere vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(oneSphere.vertices),gl.STATIC_DRAW); // data in
                normalBuffers.push(gl.createBuffer()); // init empty webgl sphere vertex normal buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(oneSphere.normals),gl.STATIC_DRAW); // data in
                uvBuffers.push(gl.createBuffer()); // init empty webgl sphere vertex uv buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[uvBuffers.length-1]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(oneSphere.uvs),gl.STATIC_DRAW); // data in
        
                triSetSizes.push(oneSphere.triangles.length);

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(oneSphere.triangles),gl.STATIC_DRAW); // data in
            } // end if sphere file loaded
        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// adds the furniture to triRenderables
function makeFurniture(i, j, type, room, item) {
    i += 1 + room*7;
    j += 1;

    if (type == "sphere") {
        var loc = vec3.fromValues(j + 0.5, 0.5, i + 0.5);
        var whichSet = item;
        for(var whichSetTri = 0; whichSetTri < inputSpheres.oneSphere.triangles.length; whichSetTri += 3) {
            var tri = triRenderables.length;

            triRenderables[tri] = [];
            triRenderables[tri].room = room; // room containing tri, -1 for portals
            var x = inputSpheres[whichSet].x;
            var y = inputSpheres[whichSet].y;
            var z = inputSpheres[whichSet].z;
            triRenderables[tri].center = vec3.create(x, y, z);  // center point of tri set
            triRenderables[tri].on = inputSpheres[whichSet].on; // not highlighted
            triRenderables[tri].whichSet = whichSet; // store set num tri belongs to
            triRenderables[tri].translation = vec3.fromValues(0,0,0); // inputTriangles[whichSet].translation; // no translation
            triRenderables[tri].xAxis = inputSpheres[whichSet].xAxis; // model X axis
            triRenderables[tri].yAxis = inputSpheres[whichSet].yAxis; // model Y axis

            triRenderables[tri].textures = textures[inputTriangles.length + whichSet]; // inputTriangles[whichSet].textures;
            triRenderables[tri].uvbo = uvBuffers[uvBuffers.length-1]; // inputTriangles[whichSet].uvbo;
            triRenderables[tri].vbo = vertexBuffers[vertexBuffers.length-1]; // inputTriangles[whichSet].vbo;
            triRenderables[tri].nbo = normalBuffers[normalBuffers.length-1]; // inputTriangles[whichSet].nbo;

            // triRenderables[tri].material = inputSpheres[whichSet].material;
            triRenderables[tri].vertices = [];

            // set up materials for single rendering function
            triRenderables[tri].material = {};
            triRenderables[tri].material.ambient = inputSpheres[whichSet].ambient;
            triRenderables[tri].material.diffuse = inputSpheres[whichSet].diffuse;
            triRenderables[tri].material.specular = inputSpheres[whichSet].specular;
            triRenderables[tri].material.n = inputSpheres[whichSet].n;
            triRenderables[tri].material.alpha = inputSpheres[whichSet].alpha;
            triRenderables[tri].material.texture = inputSpheres[whichSet].texture;

            triRenderables[tri].glTriangles = [];
            //var triToAdd = inputSpheres.oneSphere.triangles[whichSetTri]; // get tri to add
            var triToAdd = [inputSpheres.oneSphere.triangles[whichSetTri],
                            inputSpheres.oneSphere.triangles[whichSetTri+1],
                            inputSpheres.oneSphere.triangles[whichSetTri+2]];
            // console.log(triToAdd);
            triRenderables[tri].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list

            var v1 = [inputSpheres.oneSphere.vertices[triToAdd[0]],
                      inputSpheres.oneSphere.vertices[triToAdd[0]+1],
                      inputSpheres.oneSphere.vertices[triToAdd[0]+2]];
            var v2 = [inputSpheres.oneSphere.vertices[triToAdd[1]],
                      inputSpheres.oneSphere.vertices[triToAdd[1]+1],
                      inputSpheres.oneSphere.vertices[triToAdd[1]+2]];
            var v3 = [inputSpheres.oneSphere.vertices[triToAdd[2]],
                      inputSpheres.oneSphere.vertices[triToAdd[2]+1],
                      inputSpheres.oneSphere.vertices[triToAdd[2]+2]];

            triRenderables[tri].vertices = [v1,v2,v3];

            var x = inputSpheres[whichSet].x;
            var y = inputSpheres[whichSet].y;
            var z = inputSpheres[whichSet].z;

            triRenderables[tri].center = vec3.fromValues(x, y, z);// inputSpheres[whichSet].center;

            var negCenter = vec3.create();
            vec3.negate(negCenter,triRenderables[tri].center);
            vec3.add(triRenderables[tri].translation, loc, negCenter);

            triRenderables[tri].tbo = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triRenderables[tri].tbo); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(triRenderables[tri].glTriangles),gl.STATIC_DRAW); // data in
        }

    } else if (type == "triangleset") {
        var loc = vec3.fromValues(j + 0.5, 0.5, i + 0.5 - .75);
        var whichSet = item;
        for(var whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
            var tri = triRenderables.length;

            triRenderables[tri] = [];
            triRenderables[tri].room = room; // room containing tri, -1 for portals
            triRenderables[tri].center = inputTriangles[whichSet].center;  // center point of tri set
            triRenderables[tri].on = inputTriangles[whichSet].on; // not highlighted
            triRenderables[tri].whichSet = whichSet; // store set num tri belongs to
            triRenderables[tri].translation = vec3.fromValues(0,0,0); // inputTriangles[whichSet].translation; // no translation
            triRenderables[tri].xAxis = inputTriangles[whichSet].xAxis; // model X axis
            triRenderables[tri].yAxis = inputTriangles[whichSet].yAxis; // model Y axis

            triRenderables[tri].textures = textures[whichSet]; // inputTriangles[whichSet].textures;
            triRenderables[tri].uvbo = uvBuffers[whichSet]; // inputTriangles[whichSet].uvbo;
            triRenderables[tri].vbo = vertexBuffers[whichSet]; // inputTriangles[whichSet].vbo;
            triRenderables[tri].nbo = normalBuffers[whichSet]; // inputTriangles[whichSet].nbo;

            triRenderables[tri].material = inputTriangles[whichSet].material;

            triRenderables[tri].vertices = []; // inputTriangles[whichSet].vertices;

            triRenderables[tri].glTriangles = [];
            var triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
            triRenderables[tri].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list

            var v1 = inputTriangles[whichSet].vertices[triToAdd[0]];
            var v2 = inputTriangles[whichSet].vertices[triToAdd[1]];
            var v3 = inputTriangles[whichSet].vertices[triToAdd[2]];

            triRenderables[tri].vertices = [v1,v2,v3];

            triRenderables[tri].center = inputTriangles[whichSet].center;

            var negCenter = vec3.create();
            vec3.negate(negCenter,triRenderables[tri].center);
            vec3.add(triRenderables[tri].translation, loc, negCenter);

            triRenderables[tri].tbo = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triRenderables[tri].tbo); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(triRenderables[tri].glTriangles),gl.STATIC_DRAW); // data in
        }
    }
}

// adds two triangles to triRenderables
function makeSurface(loc, N, texture, room) {
    if (texture == "floor") {
        var whichSet = 4;
    } else if (texture == "ceiling") {
        var whichSet = 5;
    } else if (texture == "wall") {
        var whichSet = 6;
    }

    for(var whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
        var tri = triRenderables.length;

        triRenderables[tri] = [];
        triRenderables[tri].room = room; // room containing tri, -1 for portals
        triRenderables[tri].center = inputTriangles[whichSet].center;  // center point of tri set
        triRenderables[tri].on = inputTriangles[whichSet].on; // not highlighted
        triRenderables[tri].whichSet = whichSet; // store set num tri belongs to
        triRenderables[tri].translation = vec3.fromValues(0,0,0); // inputTriangles[whichSet].translation; // no translation
        triRenderables[tri].xAxis = vec3.fromValues(0,0,0); // inputTriangles[whichSet].xAxis; // model X axis
        triRenderables[tri].yAxis = vec3.fromValues(0,0,0); // inputTriangles[whichSet].yAxis; // model Y axis

        triRenderables[tri].textures = textures[whichSet]; // inputTriangles[whichSet].textures;
        triRenderables[tri].uvbo = uvBuffers[whichSet]; // inputTriangles[whichSet].uvbo;
        triRenderables[tri].vbo = vertexBuffers[whichSet]; // inputTriangles[whichSet].vbo;
        triRenderables[tri].nbo = normalBuffers[whichSet]; // inputTriangles[whichSet].nbo;

        triRenderables[tri].material = inputTriangles[whichSet].material;

        triRenderables[tri].vertices = []; // inputTriangles[whichSet].vertices;

        triRenderables[tri].glTriangles = [];
        var triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
        triRenderables[tri].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list

        var v1 = inputTriangles[whichSet].vertices[triToAdd[0]];
        var v2 = inputTriangles[whichSet].vertices[triToAdd[1]];
        var v3 = inputTriangles[whichSet].vertices[triToAdd[2]];

        triRenderables[tri].vertices = [v1,v2,v3];

        /*triRenderables[tri].glCenter = vec3.fromValues(0,0,0);
        var vert1 = inputTriangles[whichSet].vertices[triToAdd[0]];
        var vert2 = inputTriangles[whichSet].vertices[triToAdd[1]];
        var vert3 = inputTriangles[whichSet].vertices[triToAdd[2]];

        var A = vec3.fromValues(vert1[0],vert1[1],vert1[2]);
        var B = vec3.fromValues(vert2[0],vert2[1],vert2[2]);
        var C = vec3.fromValues(vert3[0],vert3[1],vert3[2]);

        vec3.add(triRenderables[tri].glCenter, triRenderables[tri].glCenter, A);
        vec3.add(triRenderables[tri].glCenter, triRenderables[tri].glCenter, B);
        vec3.add(triRenderables[tri].glCenter, triRenderables[tri].glCenter, C);

        vec3.multiply(triRenderables[tri].glCenter,
                        triRenderables[tri].glCenter,
                        vec3.fromValues(1/3,1/3,1/3)); */

        if (vec3.equals(N, vec3.fromValues(1,0,0))) {
            triRenderables[tri].xAxis = vec3.fromValues(0,0,-1);
            triRenderables[tri].yAxis = vec3.fromValues(0,1,0);
        } else if (vec3.equals(N, vec3.fromValues(-1,0,0))) {
            triRenderables[tri].xAxis = vec3.fromValues(0,0,1);
            triRenderables[tri].yAxis = vec3.fromValues(0,1,0);
        } else if (vec3.equals(N, vec3.fromValues(0,1,0))) {
            triRenderables[tri].xAxis = vec3.fromValues(1,0,0);
            triRenderables[tri].yAxis = vec3.fromValues(0,0,-1);
        } else if (vec3.equals(N, vec3.fromValues(0,-1,0))) {
            triRenderables[tri].xAxis = vec3.fromValues(1,0,0);
            triRenderables[tri].yAxis = vec3.fromValues(0,0,1);
        } else if (vec3.equals(N, vec3.fromValues(0,0,1))) {
            triRenderables[tri].xAxis = vec3.fromValues(-1,0,0);
            triRenderables[tri].yAxis = vec3.fromValues(0,1,0);
        } else if (vec3.equals(N, vec3.fromValues(0,0,-1))) {
            triRenderables[tri].xAxis = vec3.fromValues(1,0,0);
            triRenderables[tri].yAxis = vec3.fromValues(0,1,0);
        } else {
            console.log("Malformed N");
        }

        triRenderables[tri].center = inputTriangles[whichSet].center;

        var negCenter = vec3.create();
        vec3.negate(negCenter,triRenderables[tri].center);
        vec3.add(triRenderables[tri].translation, loc, negCenter);

        triRenderables[tri].tbo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triRenderables[tri].tbo); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(triRenderables[tri].glTriangles),gl.STATIC_DRAW); // data in
    }
}

function makeWalls(i, j, room) {
    rooms = inputRooms.rooms;
    if (rooms[j + 1][i] == "s") {
        makeSurface(vec3.fromValues(j + 1.0, 0.5, i + 0.5),
                    vec3.fromValues(-1, 0, 0),
                    "wall",
                    room);
    }
    if (rooms[j - 1][i] == "s") {
        makeSurface(vec3.fromValues(j, 0.5, i + 0.5),
                    vec3.fromValues(1, 0, 0),
                    "wall",
                    room);
    }
    if (rooms[j][i + 1] == "s") {
        makeSurface(vec3.fromValues(j + 0.5, 0.5, i + 1.0),
                    vec3.fromValues(0, 0, -1),
                    "wall",
                    room);
    }
    if (rooms[j][i - 1] == "s") {
        makeSurface(vec3.fromValues(j + 0.5, 0.5, i),
                    vec3.fromValues(0, 0, 1),
                    "wall",
                    room);
    }
}

function makeCeiling(i, j, room) {
    makeSurface(vec3.fromValues(j + 0.5, 1, i + 0.5),
                vec3.fromValues(0, -1, 0),
                "ceiling",
                room);
}

function makeFloor(i, j, room) {
    makeSurface(vec3.fromValues(j + 0.5, 0, i + 0.5),
                vec3.fromValues(0, 1, 0),
                "floor",
                room);
}

function makeCell(i, j) {
    rooms = inputRooms.rooms;
    makeFloor(i, j, rooms[j][i]);
    makeCeiling(i, j, rooms[j][i]);
    makeWalls(i, j, rooms[j][i]);
}

function makePortal(i, j) {
    makeFloor(i, j, -1);
    makeCeiling(i, j, -1);
    makeWalls(i, j, -1);

    rooms = inputRooms.rooms;

    var l = inputPortals.length;
    inputPortals[l] = {};
    inputPortals[l + 1] = {};

    if (rooms[j][i - 1] != "s") {
        var c1 = rooms[j][i - 1];
        var c2 = rooms[j][i + 1];

        var A1 = vec3.fromValues(j,1.0,i + 1.0);
        var B1 = vec3.fromValues(j + 1.0,1.0,i + 1.0);
        var C1 = vec3.fromValues(j,0.0,i + 1.0);
        var D1 = vec3.fromValues(j + 1.0,0.0,i + 1.0);

        var A2 = vec3.fromValues(j,1.0,i);
        var B2 = vec3.fromValues(j + 1.0,1.0,i);
        var C2 = vec3.fromValues(j,0.0,i);
        var D2 = vec3.fromValues(j + 1.0,0.0,i);

        inputPortals[l].rooms = [c1,c2];
        inputPortals[l + 1].rooms = [c2,c1];

        inputPortals[l].vertices = [A1,B1,C1,D1];
        inputPortals[l + 1].vertices = [A2,B2,C2,D2];

        inputPortals[l].center = vec3.fromValues(j + 0.5,0.5,i + 1.0);
        inputPortals[l + 1].center = vec3.fromValues(j + 0.5,0.5,i);

        inputPortals[l].xAxis = vec3.fromValues(1,0,0);
        inputPortals[l + 1].xAxis = vec3.fromValues(1,0,0);

        inputPortals[l].yAxis = vec3.fromValues(0,1,0);
        inputPortals[l + 1].yAxis = vec3.fromValues(0,1,0);

        inputPortals[l].translation = vec3.fromValues(0,0,0);
        inputPortals[l + 1].translation = vec3.fromValues(0,0,0);

    } else if (room[j - 1][i] != "s") { // TODO
        var c1 = rooms[j - 1][i];
        var c2 = rooms[j + 1][i];
        
    }
}

// read rooms file in and create surfaces
function loadRooms() {
    inputRooms = getJSONFile(INPUT_ROOMS_URL,"rooms"); // read in the triangle data

    try {
        if (inputRooms == String.null)
            throw "Unable to load rooms file!";
        else {
            var rooms = inputRooms.rooms;
            // console.log(rooms);

            for (var j = 0; j < rooms.length; j++) {
                for (var i = 0; i < rooms[j].length; i++) {
                    if (typeof rooms[j][i] == "number") {
                        makeCell(i, j);
                        // console.log("Making Cell at " + i + ", " + j)
                    } else if (rooms[j][i] == "p") {
                        makePortal(i, j);
                        // console.log("Making Portal at " + i + ", " + j)
                    }
                }
            }

            var furniture = inputRooms.furniture;

            for (var f = 0; f < furniture.length; f++) {
                var room = furniture[f][0];
                var i = furniture[f][1];
                var j = furniture[f][2];
                var type = furniture[f][3];
                var item = furniture[f][4];

                makeFurniture(i, j, type, room, item);
            }
        }
    }

    catch(e) {
        console.log(e);
    }
}

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
            
            if (!uUsingTexture) {
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
                
                // pass global (not per model) constants into fragment uniforms
                // gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position // causes static eye pos calculations
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                //gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
                gl.uniform3fv(lightPos1ULoc,lightPos1); // pass in light1's position
                gl.uniform3fv(lightPos2ULoc,lightPos2); // pass in light2's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

function frustumCulling() {

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

    var tris = [];
    for (var t=0; t<triRenderables.length; t++) {
        var tri = triRenderables[t];

        var pos1 = tri.glTriangles[0];
        var pos2 = tri.glTriangles[1];
        var pos3 = tri.glTriangles[2];

        var vert1 = tri.vertices[0];
        var vert2 = tri.vertices[1];
        var vert3 = tri.vertices[2];

        // screen coor
        var v1 = vec3.fromValues(vert1[0], vert1[1], vert1[2]);
        var v2 = vec3.fromValues(vert2[0], vert2[1], vert2[2]);
        var v3 = vec3.fromValues(vert3[0], vert3[1], vert3[2]);

        // world coor
        var w1 = vec3.fromValues(vert1[0], vert1[1], vert1[2]);
        var w2 = vec3.fromValues(vert2[0], vert2[1], vert2[2]);
        var w3 = vec3.fromValues(vert3[0], vert3[1], vert3[2]);

        makeModelTransform(tri);
        
        // set up handedness, projection and view
        mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
        mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
        mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
        mat4.multiply(hpvMatrix,hMatrix,pMatrix); // handedness * projection
        mat4.multiply(hpvMatrix,hpvMatrix,vMatrix); // handedness * projection * view
        mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // handedness * project * view * model

        vec3.transformMat4(v1, v1, hpvmMatrix);
        vec3.transformMat4(v2, v2, hpvmMatrix);
        vec3.transformMat4(v3, v3, hpvmMatrix);

        // world
        vec3.transformMat4(w1, w1, mMatrix);
        vec3.transformMat4(w2, w2, mMatrix);
        vec3.transformMat4(w3, w3, mMatrix);

        var verts = [v1, v2, v3];
        var l = tris.length;
        for (var v = 0; v < 3; v++) {
            var vert = verts[v];

            // handle enclosed tris
            if (vert[0] < 1.1 && vert[0] > -1.1) {
                if (vert[1] < 1.1 && vert[1] > -1.1) {
                    if (vert[2] < 1.0 && vert[2] > 0.0) {
                        tris[tris.length] = tri;
                        break;
                    }
                }
            }

            // handle tris intersecting frustum
            /*
            var END = false;
            for (var v0 = v + 1; v0 < 3; v0++) {
                var otherVert = verts[v0];

                // Right Bound
                if ((vert[0] < 1.0 && otherVert[0] > 1.0 ||
                    vert[0] > 1.0 && otherVert[0] < 1.0) &&
                    (vert[1] < 1.5 && vert[1] > -1.5 ||
                    otherVert[1] < 1.5 && otherVert[1] > -1.5)) {
                    if (v1[2] < 1.0 && v1[2] > 0.0 ||
                        v2[2] < 1.0 && v2[2] > 0.0 ||
                        v3[2] < 1.0 && v3[2] > 0.0) {
                        tris[tris.length] = tri;
                        END = true;
                        break;
                    }
                }

                // Left Bound
                else if ((vert[0] < -1.0 && otherVert[0] > -1.0 ||
                    vert[0] > -1.0 && otherVert[0] < -1.0) &&
                    (vert[1] < 1.5 && vert[1] > -1.5 ||
                    otherVert[1] < 1.5 && otherVert[1] > -1.5)) {
                    if (v1[2] < 1.0 && v1[2] > 0.0 ||
                        v2[2] < 1.0 && v2[2] > 0.0 ||
                        v3[2] < 1.0 && v3[2] > 0.0) {
                        tris[tris.length] = tri;
                        END = true;
                        break;
                    }
                }

                // Upper Bound
                else if ((vert[1] < 1.0 && otherVert[1] > 1.0 ||
                    vert[1] > 1.0 && otherVert[1] < 1.0) &&
                    (vert[0] < 1.5 && vert[0] > -1.5 ||
                    otherVert[0] < 1.5 && otherVert[0] > -1.5)) {
                    if (v1[2] < 1.0 && v1[2] > 0.0 ||
                        v2[2] < 1.0 && v2[2] > 0.0 ||
                        v3[2] < 1.0 && v3[2] > 0.0) {
                        tris[tris.length] = tri;
                        END = true;
                        break;
                    }
                }

                // Lower Bound
                else if ((vert[1] < -1.0 && otherVert[1] > -1.0 ||
                    vert[1] > -1.0 && otherVert[1] < -1.0) &&
                    (vert[0] < 1.5 && vert[0] > -1.5 ||
                    otherVert[0] < 1.5 && otherVert[0] > -1.5)) {
                    if (v1[2] < 1.0 && v1[2] > 0.0 ||
                        v2[2] < 1.0 && v2[2] > 0.0 ||
                        v3[2] < 1.0 && v3[2] > 0.0) {
                        tris[tris.length] = tri;
                        END = true;
                        break;
                    }
                }

            }
            if(END) {break;}*/
        }


        /*if(l == tris.length) {
        console.log("Culled:");

            console.log(w1);
            console.log(w2);
            console.log(w3);

            console.log("<-->");
             console.log(tri.translation);
            console.log("<-->");

            console.log(verts[0]);
            console.log(verts[1]);
            console.log(verts[2]);
        }*/
    }

    return tris;
}

function frustumCullCell(cell, rightB, leftB, upperB, lowerB, level) {

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

    var tris = [];
    for (var t=0; t<triRenderables.length; t++) {
        var tri = triRenderables[t];

        if (tri.room != cell && tri.room != -1) {continue;}
        if (tri.used) {continue;}

        var pos1 = tri.glTriangles[0];
        var pos2 = tri.glTriangles[1];
        var pos3 = tri.glTriangles[2];

        var vert1 = tri.vertices[0];
        var vert2 = tri.vertices[1];
        var vert3 = tri.vertices[2];

        // screen coor
        var v1 = vec3.fromValues(vert1[0], vert1[1], vert1[2]);
        var v2 = vec3.fromValues(vert2[0], vert2[1], vert2[2]);
        var v3 = vec3.fromValues(vert3[0], vert3[1], vert3[2]);

        // world coor
        var w1 = vec3.fromValues(vert1[0], vert1[1], vert1[2]);
        var w2 = vec3.fromValues(vert2[0], vert2[1], vert2[2]);
        var w3 = vec3.fromValues(vert3[0], vert3[1], vert3[2]);

        makeModelTransform(tri);
        
        // set up handedness, projection and view
        mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
        mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
        mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
        mat4.multiply(hpvMatrix,hMatrix,pMatrix); // handedness * projection
        mat4.multiply(hpvMatrix,hpvMatrix,vMatrix); // handedness * projection * view
        mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // handedness * project * view * model

        vec3.transformMat4(v1, v1, hpvmMatrix);
        vec3.transformMat4(v2, v2, hpvmMatrix);
        vec3.transformMat4(v3, v3, hpvmMatrix);

        // world
        vec3.transformMat4(w1, w1, mMatrix);
        vec3.transformMat4(w2, w2, mMatrix);
        vec3.transformMat4(w3, w3, mMatrix);

        var verts = [v1, v2, v3];
        var l = tris.length;
        for (var v = 0; v < 3; v++) {
            var vert = verts[v];

            // handle enclosed tris
            if (vert[0] < rightB + 0.1 && vert[0] > leftB - 0.1) {
                if (vert[1] < upperB + 0.1 && vert[1] > lowerB - 0.1) {
                    if (vert[2] < 1.0 && vert[2] > 0.0) {
                        tris[tris.length] = tri;
                        tri.used = true;
                        break;
                    }
                }
            }

            // handle tris intersecting frustum
            /*
            var END = false;
            for (var v0 = v + 1; v0 < 3; v0++) {
                var otherVert = verts[v0];

                // Right Bound
                if ((vert[0] < 1.0 && otherVert[0] > 1.0 ||
                    vert[0] > 1.0 && otherVert[0] < 1.0) &&
                    (vert[1] < 1.5 && vert[1] > -1.5 ||
                    otherVert[1] < 1.5 && otherVert[1] > -1.5)) {
                    if (v1[2] < 1.0 && v1[2] > 0.0 ||
                        v2[2] < 1.0 && v2[2] > 0.0 ||
                        v3[2] < 1.0 && v3[2] > 0.0) {
                        tris[tris.length] = tri;
                        END = true;
                        break;
                    }
                }

                // Left Bound
                else if ((vert[0] < -1.0 && otherVert[0] > -1.0 ||
                    vert[0] > -1.0 && otherVert[0] < -1.0) &&
                    (vert[1] < 1.5 && vert[1] > -1.5 ||
                    otherVert[1] < 1.5 && otherVert[1] > -1.5)) {
                    if (v1[2] < 1.0 && v1[2] > 0.0 ||
                        v2[2] < 1.0 && v2[2] > 0.0 ||
                        v3[2] < 1.0 && v3[2] > 0.0) {
                        tris[tris.length] = tri;
                        END = true;
                        break;
                    }
                }

                // Upper Bound
                else if ((vert[1] < 1.0 && otherVert[1] > 1.0 ||
                    vert[1] > 1.0 && otherVert[1] < 1.0) &&
                    (vert[0] < 1.5 && vert[0] > -1.5 ||
                    otherVert[0] < 1.5 && otherVert[0] > -1.5)) {
                    if (v1[2] < 1.0 && v1[2] > 0.0 ||
                        v2[2] < 1.0 && v2[2] > 0.0 ||
                        v3[2] < 1.0 && v3[2] > 0.0) {
                        tris[tris.length] = tri;
                        END = true;
                        break;
                    }
                }

                // Lower Bound
                else if ((vert[1] < -1.0 && otherVert[1] > -1.0 ||
                    vert[1] > -1.0 && otherVert[1] < -1.0) &&
                    (vert[0] < 1.5 && vert[0] > -1.5 ||
                    otherVert[0] < 1.5 && otherVert[0] > -1.5)) {
                    if (v1[2] < 1.0 && v1[2] > 0.0 ||
                        v2[2] < 1.0 && v2[2] > 0.0 ||
                        v3[2] < 1.0 && v3[2] > 0.0) {
                        tris[tris.length] = tri;
                        END = true;
                        break;
                    }
                }

            }
            if(END) {break;}*/
        }


        /*if(l == tris.length) {
        console.log("Culled:");

            console.log(w1);
            console.log(w2);
            console.log(w3);

            console.log("<-->");
             console.log(tri.translation);
            console.log("<-->");

            console.log(verts[0]);
            console.log(verts[1]);
            console.log(verts[2]);
        }*/
    }

    var tris2 = [];
    if(level < 2) {
    //var portals = adjacencyGraph.getPortals();
    for (var p = 0; p < inputPortals.length; p++) {
        var portal = inputPortals[p];
        var rooms = portal.rooms;
        if(rooms[0] != cell) {continue;}
        var vertices = portal.vertices;

        var vertA = vertices[0];
        var vertB = vertices[1];
        var vertC = vertices[2];
        var vertD = vertices[3];

        var A = vec3.fromValues(vertA[0],vertA[1],vertA[2]);
        var B = vec3.fromValues(vertB[0],vertB[1],vertB[2]);
        var C = vec3.fromValues(vertC[0],vertC[1],vertC[2]);
        var D = vec3.fromValues(vertD[0],vertD[1],vertD[2]);

        makeModelTransform(portal);
        
        // set up handedness, projection and view
        mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
        mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
        mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
        mat4.multiply(hpvMatrix,hMatrix,pMatrix); // handedness * projection
        mat4.multiply(hpvMatrix,hpvMatrix,vMatrix); // handedness * projection * view
        mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // handedness * project * view * model

        vec3.transformMat4(A, A, hpvmMatrix);
        vec3.transformMat4(B, B, hpvmMatrix);
        vec3.transformMat4(C, C, hpvmMatrix);
        vec3.transformMat4(D, D, hpvmMatrix);

        var verts = [A,B,C,D];

        var visible = false;
        for (var v = 0; v < 3; v++) {
            var vert = verts[v];

            // handle enclosed tris
            if (vert[0] < rightB /*+ 0.1*/ && vert[0] > leftB /*- 0.1*/) {
                if (vert[1] < upperB /*+ 0.1*/&& vert[1] > lowerB /*- 0.1*/) {
                    if (vert[2] < 1.0 && vert[2] > 0.0) {
                        var visible = true;
                        break;
                    }
                }
            }
        }

        if (visible) {
            var rightB2 = Math.max(A[0],B[0],C[0],D[0]);
            var leftB2 = Math.min(A[0],B[0],C[0],D[0]);
            var upperB2 = Math.max(A[1],B[1],C[1],D[1]);
            var lowerB2 = Math.min(A[1],B[1],C[1],D[1]);

            var cell2 = rooms[1];

            tris2 = tris2.concat(frustumCullCell(cell2, rightB2, leftB2, upperB2, lowerB2, level + 1));
        }
    }}

    return tris.concat(tris2);
}

function getCell() { // TODO

    var i = Math.floor(Eye[2]);
    var j = Math.floor(Eye[0]);

    var rooms = inputRooms.rooms;

    /*if (j > 0 && j < rooms.length) {
        if (i < rooms[j].length) {
            var cell = rooms[j][i];
        }
    }*/
    if (Eye[0] > 1.0 && Eye[0] < 6.0) {
        if (Eye[2] > 1.0 && Eye[2] < 6.51) {
            if (Eye[1] > 0.0 && Eye[1] < 1.0) {
                return 0;
            }
        }
    } else if (Eye[0] > 1.0 && Eye[0] < 6.0) {
        if (Eye[2] > 6.49 && Eye[2] < 12.0) {
            if (Eye[1] > 0.0 && Eye[1] < 1.0) {
                return 1;
            }
        }
    }

    return -1;
}

function portalCulling() {

    cell = getCell();

    if (cell == -1) {return frustumCulling();}

    for (var t = 0; t < triRenderables.length; t++) {
        triRenderables[t].used = false;
    }

    // entire screen
    rightB = 1.0;
    leftB = -1.0;
    upperB = 1.0;
    lowerB = -1.0;

    return frustumCullCell(cell, rightB, leftB, upperB, lowerB, 1) // TODO
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
    
    gl.clear(/*gl.COLOR_BUFFER_BIT |*/ gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up handedness, projection and view
    mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(hpvMatrix,hMatrix,pMatrix); // handedness * projection
    mat4.multiply(hpvMatrix,hpvMatrix,vMatrix); // handedness * projection * view

    gl.uniform3fv(eyePositionULoc,Eye); // update eye position

    /* perform desired culling */
    var tris;
    if (cullMode == 1) {
        tris = triRenderables;
    } else if (cullMode == 2) {
        tris = frustumCulling();
    } else if (cullMode == 3) {
        tris = portalCulling();
    }

    // render each triangle
    var currTri, triMaterial; // the tri set and its material properties
    for (var t=0; t<tris.length; t++) {
        // console.log("Rendering tri " + t);
        currTri = tris[t];
        
        // make model transform, add to view project
        makeModelTransform(currTri);
        mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // handedness * project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, hpvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        if (inputTriangles[currTri.whichSet].on)
            setMaterial = HIGHLIGHTMATERIAL; // highlight material
        else
            setMaterial = currTri.material; // normal material
        gl.uniform3fv(ambientULoc,setMaterial.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,setMaterial.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,setMaterial.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,setMaterial.n); // pass in the specular exponent
        gl.uniform1i(usingTextureULoc,(currTri.material.texture != false)); // whether the set uses texture
        gl.activeTexture(gl.TEXTURE0); // bind to active texture 0 (the first)
        gl.bindTexture(gl.TEXTURE_2D, textures[currTri.whichSet]); // bind the set's texture
        gl.uniform1i(textureULoc, 0); // pass in the texture and active texture 0
        
        // position, normal and uv buffers: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,currTri.vbo); // vertexBuffers[currTri.whichSet]); // activate position
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,currTri.nbo); // normalBuffers[currTri.whichSet]); // activate normal
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,currTri.uvbo); // uvBuffers[currTri.whichSet]); // activate uv
        gl.vertexAttribPointer(vUVAttribLoc,2,gl.FLOAT,false,0,0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,currTri.tbo); // activate
        gl.drawElements(gl.TRIANGLES,3,gl.UNSIGNED_SHORT,0); // render
        
    } // end for each triangle set

    /* Update GUI */
    trisNode.nodeValue = tris.length;

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

    // render each triangle set
    var currSet, setMaterial; // the tri set and its material properties
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet];
        
        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // handedness * project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, hpvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        if (inputTriangles[whichTriSet].on)
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

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
        
    } // end for each triangle set
    
    // render each sphere
    var sphere, currentMaterial, instanceTransform = mat4.create(); // the current sphere and material
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // activate vertex buffer
    gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate normal buffer
    gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader
    gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[uvBuffers.length-1]); // activate uv
    gl.vertexAttribPointer(vUVAttribLoc,2,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[triangleBuffers.length-1]); // activate tri buffer
    
    for (var whichSphere=0; whichSphere<numSpheres; whichSphere++) {
        sphere = inputSpheres[whichSphere];
        
        // define model transform, premult with pvmMatrix, feed to shader
        makeModelTransform(sphere);
        mat4.fromTranslation(instanceTransform,vec3.fromValues(sphere.x,sphere.y,sphere.z)); // recenter sphere
        mat4.scale(mMatrix,mMatrix,vec3.fromValues(sphere.r,sphere.r,sphere.r)); // change size
        mat4.multiply(mMatrix,instanceTransform,mMatrix); // apply recenter sphere
        hpvmMatrix = mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // premultiply with hpv matrix
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, hpvmMatrix); // pass in handed project view model matrix

        // reflectivity: feed to the fragment shader
        if (sphere.on)
            currentMaterial = HIGHLIGHTMATERIAL;
        else
            currentMaterial = sphere;
        gl.uniform3fv(ambientULoc,currentMaterial.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,currentMaterial.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,currentMaterial.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,currentMaterial.n); // pass in the specular exponent
        gl.uniform1i(usingTextureULoc,(sphere.texture != false)); // whether the sphere uses texture
        gl.activeTexture(gl.TEXTURE0); // bind to active texture 0 (the first)
        gl.bindTexture(gl.TEXTURE_2D, textures[numTriangleSets+whichSphere]); // bind the set's texture
        gl.uniform1i(textureULoc, 0); // pass in the texture and active texture 0

        // draw a transformed instance of the sphere
        gl.drawElements(gl.TRIANGLES,triSetSizes[triSetSizes.length-1],gl.UNSIGNED_SHORT,0); // render
    } // end for each sphere
} // end render model


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  setupShaders(); // setup the webGL shaders
  loadRooms(); // load in the rooms from rooms file
  renderModels(); // draw the triangles using webGL
  
} // end main

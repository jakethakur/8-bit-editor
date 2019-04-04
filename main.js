const EditorVersion = "0.3.1"

//
// Setup
//

// start the program when the window has loaded
window.addEventListener("load", setup, false);

function setup() {
	// elements
	
	// canvases
	Els.editor = document.querySelector("#editor"); // main image canvas (this is exported at the end)
	Els.transparency = document.querySelector("#transparency"); // transparency canvas
	Els.saveCanvas = document.querySelector("#saveCanvas"); // image save canvas (always hidden)
	
	// hidden elements (shown when a certain menu is opened)
	Els.savedImageWrapper = document.querySelector("#savedImageWrapper"); // save art wrapper (hidden unless saved art is shown)
	Els.loadArtLocalWrapper = document.querySelector("#loadArtLocalWrapper"); // load art wrapper (hidden until load art to local storage)
	Els.metadataWrapper = document.querySelector("#metadataWrapper"); // metadata wrapper (hidden until art metadata is changed)
	Els.loadArtJSONWrapper = document.querySelector("#loadArtJSONWrapper"); // file upload screen
	
	// settings
	Els.toolButtons = document.getElementsByName('tool'); // tool setting radio buttons
	Els.colorWell = document.querySelector("#colorWell"); // color well
	Els.localStoreEnabled = document.querySelector("#localStoreEnabled"); // local storage on setting
	
	// metadata inputs
	Els.artNameInput = document.querySelector("#artNameInput"); // art name
	Els.authorInput = document.querySelector("#authorInput"); // author name
	
	// load from local storage output
	Els.savedArtList = document.querySelector("#savedArtList"); // list of saved art
	
	// upload JSON file input
	Els.artInput = document.querySelector("#artInput");
	
	
	
	// canvas context
	Ctx.editor = Els.editor.getContext('2d');
	Ctx.transparency = Els.transparency.getContext('2d');
	
	// brush
	Tool = "brush";
	Brush.color = Els.colorWell.value; // default color
	Ctx.editor.fillStyle = Els.colorWell.value; // default color
	Brush.size = 16; // pixels
	
	init();
	
	// color well
	Els.colorWell.addEventListener("change", updateColor, false); // update the brush color upon color change
	Els.colorWell.select();
	
	// local storage
	setLocaStorageSetting(); // radio button
	loadCurrentArt(); // load art if setting is on
	
	// canvas event listeners (for painting)
	Els.editor.addEventListener("mousemove", paint); // paint tile if mouse is moved (checks if mouse is down)
	Els.editor.addEventListener("mousedown", mouseDown); // mouse set to down
	Els.editor.addEventListener("mouseup", mouseUp); // mouse set to up
	Els.editor.addEventListener("mouseout", mouseUp); // also set mouse to up when user leaves the canvas with mouse
}

//
// Init new canvas (called every time a new canvas is created, e.g. canvas resized)
//

function init() {
	setCanvasSizeVariables(); // set canvas size variables
	drawTransparency(); // draw transparency grid
	initImageData();
	
	// reset undo and redo
	undoArray = [];
	redoArray = [];
	
	// reset metadata
	Els.artNameInput.value = "";
	Els.authorInput.value = "";
	
	// add deep copied version of empty image data to undoArray
	undoArray.push(deepCopyImageData(ImageData));
}

// set canvas size variable
// cols = drawable squares in x axis
// rows = drawable squares in y axis
// called on init and whenever brush size changes
function setCanvasSizeVariables() {
	canvasSize.cols = Els.editor.width / Brush.size;
	canvasSize.rows = Els.editor.height / Brush.size;
}

// fill transparency grid background (grey and white)
// called on init and whenever brush size changes
function drawTransparency() {
	// clear canvas
	Ctx.transparency.clearRect(0, 0, Els.transparency.width, Els.transparency.height);
	
	// set color for drawing
	Ctx.transparency.fillStyle = "#eeeeee"; // tbd more specific color?
	
	// for loops to draw squares in checkerboard pattern
	for (let col = 0; col < canvasSize.cols; col++) {
		for (let row = col % 2; row < canvasSize.rows; row += 2) {
			// +=2 to make every other square grey
			// starting position alternates between 0 and 1
			Ctx.transparency.fillRect(col * Brush.size + 1, row * Brush.size + 1, Brush.size, Brush.size);
			// +1 so border is not drawn on
		}
	}
}

// initialise art variable as a transparent canvas
function initImageData() {
	// reset imageData
	ImageData = [];
	
	for (let col = 0; col < canvasSize.cols; col++) {
		let foo = [];
		for (let row = 0; row < canvasSize.rows; row++) {
			foo[row] = undefined; // undefined = transparent
		}
		ImageData[col] = foo;
	}
}

//
// Global variable definition
//

var ImageData = [];

var Brush = {};

var Tool = "";

var Els = {}; // elements

var Ctx = {}; // canvas contexts

var mouseIsDown = false; // set to false when mouse is up (on editor canvas) and true when it is down

var saving = false; // set to the save dimensions when the image is in the process of being saved

var canvasSize = {};

var undoArray = []; // array of previous canvas state ImageDatas (saved on mouse up)
var redoArray = []; // array of future canvas state ImageDatas (added to by undo function and wiped on mouse down)
// the empty image data is added to undoArray by the init function

var afterMetadataClose; // set to a function that should be called after metadata is closed

//
// Event listener functions
//

// called on mouse down
function mouseDown(event) {
	mouseIsDown = true; // set to down
	
	if (saving !== false) {
		// saving selection
		if (saving.startPos === undefined) {
			let position = findTile(event);
			
			// saving start position has not been saved yet
			saving.startPos = position;
		}
	}
	else {
		// not saving
		
		// remove any redos from the player now they are drawing
		redoArray = [];
		
		// update selected tool (since it can only be changed before mouseDown is called - not whilst mouse is down)
		Tool = getSelectedTool();
		
		paint(event); // initial paint tile (for click)
	}
}


// called on mouse up or leave
function mouseUp(event) {
	mouseIsDown = false; // set to up
	
	if (saving !== false && saving.startPos !== undefined) {
		// saving selection
		
		// save finish position for saving
		let position = findTile(event);
		saving.finishPos = position;
		// image save popup
		// the image is copied to another canvas that is set to the desired size - the image on this other cangvas is hence saved
		// thanks to https://stackoverflow.com/a/16974203/9713957
		// set starting variable values (because user would not have always started at top left)
		let startPos = {
			col: Math.min(saving.startPos.col, saving.finishPos.col),
			row: Math.min(saving.startPos.row, saving.finishPos.row),
		};
		let finishPos = {
			col: Math.max(saving.startPos.col, saving.finishPos.col),
			row: Math.max(saving.startPos.row, saving.finishPos.row),
		};
		// set image properties from saving variables
		let clippingX = startPos.col * Brush.size;
		let clippingY = startPos.row * Brush.size;
		let imageWidth = finishPos.col * Brush.size - clippingX + Brush.size;
		let imageHeight = finishPos.row * Brush.size - clippingY + Brush.size;
		// set size of save canvas
		Els.saveCanvas.width = imageWidth;
		Els.saveCanvas.height = imageHeight;
		// draw the image onto the save canvas
		Els.saveCanvas.getContext('2d').drawImage(Els.editor, clippingX, clippingY, imageWidth, imageHeight, 0, 0, imageWidth, imageHeight);
		saveArt(Els.saveCanvas);
	}
	
	else {
		// not saving hence art has been changed; save this version of the art to undoArray
		
		// check the art has changed
		if (JSON.stringify(undoArray[undoArray.length-1]) !== JSON.stringify(ImageData)) {
			// deep copy image data array (so it does not change when in undoArray)
			let currentImageData = deepCopyImageData(ImageData);
			// add to undo history
			undoArray.push(currentImageData);
			// save to local storage if user has setting enabled (so they can refesh and it is still there)
			saveCurrentArt();
		}
	}
}

//
// Setting functions
//

// returns the currently selected tool (called on mouseDown to set Tool)
function getSelectedTool() {
	for (let i = 0; i < Els.toolButtons.length; i++) {
		if (Els.toolButtons[i].checked) {
			// selected tool found
			return Els.toolButtons[i].value;
		}
	}
}

// update brush color
function updateColor(event) {
	Brush.color = event.target.value;
	Ctx.editor.fillStyle = event.target.value; // update canvas fill color
}

// init art selection save
function saveArtSelection() {
	// check that nothing is being currently saved
	if (saving === false) {
		saving = {}; // ready for startPos and finishPos to be saved, in the format of an object with row and col parameters
	}
}

// save art based on a canvas
// parameter is canvas element which should be saved (this might be the saveCanvas if only a subsection of the data is being saved)
function saveArt(canvas) {
	// create image element
	let img = canvas.toDataURL("image/png");
	let imgEl = document.createElement("img");
	imgEl.src = img;
	imgEl.id = "savedImage"; // for styling (positioned in centre)
	// append it to saved image wrapper
	Els.savedImageWrapper.appendChild(imgEl);
	
	// set saving variable so the editor is aware that an image is showing
	// this is set back to closed once the image is dismissed, in order to stop two images being shown at once
	saving = "saved";
	
	// show the whole wrapper (image and close button)
	Els.savedImageWrapper.hidden = false;
}

// close the saved art being shown, hence allowing the user to draw / save again
function closeSavedArt() {
	let element = document.getElementById("savedImage"); // get the image
	if (element !== null) {
		// there is a saved image showing
		element.parentNode.removeChild(element); // remove it
		
		// reset saving variable so user can draw again
		saving = false;
	
		// hide the whole wrapper (image and close button)
		Els.savedImageWrapper.hidden = true;
	}
}

// user setting to clear the editor canvas
function clearAll() {
	if (confirm("Are you sure you want to clear the canvas? The previous states will still be accessible in the undo history.")) {
		clearCanvas(true);
	}
}

// set the dimensions of the canvases
// this clears any existing drawing on it
function setDimensions() {
	// check they are happy for their art to be cleared
	if (confirm("Are you sure you want to resize the canvas? This will clear any existing art on it and remove the undo history.")) {
		// take inputs
		let width = parseInt(prompt("Please enter pixel width value for canvas (leave blank to remain the same)"));
		let height = parseInt(prompt("Please enter height width value for canvas (leave blank to remain the same)"));
		
		resizeCanvas(width, height);
	}
}

// user setting to reset (re-init) the editor canvas
function resetCanvas() {
	if (confirm("Are you sure you want to reset the canvas? This will also reset the canvas dimensions and delete the undo history.")) {
		// reset height and width to their default values
		// also re-inits canvas
		resizeCanvas(512, 512);
	}
}

// open and init local storage inport menu
function loadArtLocalMenu(canvas) {
	if (confirmLocalStorage()) {
		// local storage enabled
		
		// parse the array of saved art so .metadata and .imageData can be accessed for each element
		let savedArtArray = parseArtArray(localStorage.getItem("savedArt"));
		
		if (savedArtArray !== null) {
			// art has been saved before
			
			// init the menu
			loadArtLocalMenuUpdate(savedArtArray);
			
			// show the whole wrapper
			Els.loadArtLocalWrapper.hidden = false;
		}
		else {
			// no need to open menu since nothing has been saved
			alert("You have no local saved art to load!");
		}
	}
}


// re-init the display of the load art local menu
function loadArtLocalMenuUpdate(savedArtArray) {
	// wipe the previously generated saved art list
	Els.savedArtList.innerHTML = "";
	
	if (savedArtArray == null || savedArtArray.length === 0) {
		// parameter is undefined, null, or empty (double equals are intentional to catch undefined)
		// no art to display; display a nice message instead
		Els.savedArtList.innerHTML += "No local saved art to be shown."
	}
	else {
		// now add art to the saved art list from the saved art array
		for (let i = 0; i < savedArtArray.length; i++) {
			
			// delete art from local storage element
			let deleteArtElement = document.createElement('span');
			// styling
			deleteArtElement.classList.add("artDeleteButton");
			deleteArtElement.innerText = "delete";
			// onclick to delete the art (done via closure)
			deleteArtElement.onclick = createArtDeleteOnclick(savedArtArray[i].metadata.name);
			// add the element!
			Els.savedArtList.appendChild(deleteArtElement);
			
			// list element the art is contained in
			let listElement = document.createElement('li');
			// add onclick to load the art
			listElement.onclick = createArtLoadOnclick(savedArtArray[i].imageData, savedArtArray[i].metadata);
			// displayed text for the art
			// name
			listElement.innerHTML += "<strong>" + savedArtArray[i].metadata.name + "</strong>";
			// last edited
			listElement.innerHTML += "   <i>(last edited: " + savedArtArray[i].metadata.date + ")</i>";
			// add the element!
			Els.savedArtList.appendChild(listElement);
		}
	}
}

// save art as JSON file
function saveArtJSON() {
	if (confirmMetadata(saveArtJSON)) {
		// metadata is fine

		// get the art's JSON
		let artJSON = getArtJSON();
		
		// create the file
		let filename = "art.json";
		let blob = new Blob([artJSON], {type: 'text/plain'});
		if (window.navigator && window.navigator.msSaveOrOpenBlob) {
			window.navigator.msSaveOrOpenBlob(blob, filename);
		}
		else {
			let e = document.createEvent('MouseEvents');
			let a = document.createElement('a');
			a.download = filename;
			a.href = window.URL.createObjectURL(blob);
			a.dataset.downloadurl = ['text/plain', a.download, a.href].join(':');
			e.initEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
			a.dispatchEvent(e);
		}
	}
}

// called once an uploaded file has been confirmed
function readUploadedFile() {
	const file = Els.artInput.files[0];
	
	if (file !== undefined) {
		// set up new file reader
		let reader = new FileReader();
		
		let fileContents;
		
		// called by readAsText
		reader.onload = (function(e) {
			contents = e.target.result;
			// now use these contents
			loadArtJSON(contents);
			// close the menu and reset the file input
			Els.loadArtJSONWrapper.hidden = true;
			Els.artInput.value = null;
		});

		// read as text
		reader.readAsText(file);
	}
	else {
		alert("No file selected!");
	}
}

//
// Canvas functions (tools)
//

// paint a tile
// this function is called on mouse move, hence it needs to check if the mouse is up or down first
// TBD - possibly inefficient that this is called so often?
function paint(event) {
	// check if the mouse is down
	if (mouseIsDown) {
		// find cursor row and column
		let position = findTile(event);
		if (saving === false) {
			// only paint when the image is not being saved and a saved image is not shown
			if (Tool === "brush") {
				// set the tile's color
				setTile(position);
			}
			else if (Tool === "eraser") {
				// erase the tile
				eraseTile(position);
			}
		}
	}
}

// find tile to draw, based on mouse position
// returns object with properties col (column) and row
function findTile(event) {
	let rect = Els.editor.getBoundingClientRect(); // take into account scrolled viewport and moved canvas
	let x = event.clientX - rect.left;
	let y = event.clientY - rect.top;
	let col = Math.floor(x / Brush.size);
	let row = Math.floor(y / Brush.size);
	return {col: col, row: row};
}

// sets a tile and renders this change onto the editor canvas
function setTile(position) {
	// update imagedata
	setImageData(position, Brush.color);
	
	// draw change onto editor canvas
	Ctx.editor.fillRect(position.col * Brush.size, position.row * Brush.size, Brush.size, Brush.size);
}

// sets a tile and renders this change onto the editor canvas
function eraseTile(position) {
	// update imagedata
	setImageData(position, undefined); // undefined = transparent
	
	// draw change onto editor canvas
	Ctx.editor.clearRect(position.col * Brush.size, position.row * Brush.size, Brush.size, Brush.size);
}

// clears the editor canvas
// addToUndo is a boolean of whether the cleared canvas should be saved to undo
function clearCanvas(addToUndo) {
	Ctx.editor.clearRect(0, 0, Els.editor.width, Els.editor.height);
	
	// reset image data
	initImageData();
	
	// save to local storage if user has setting enabled (so they can refesh and it is also cleared)
	saveCurrentArt();
	
	if (addToUndo) {
		// add deep copied version of empty image data to undoArray
		undoArray.push(deepCopyImageData(ImageData));
	}
}

// set the size of the canvas to a rounded version of any correct parameters (width and height)
// also re-inits canvas
function resizeCanvas(width, height) {
	if (!isNaN(width) && width > 0) {
		// valid width value
		
		// round to brush size
		width = Math.ceil(width/Brush.size)*Brush.size;
		
		// resize canvases
		Els.editor.width = width;
		Els.transparency.width = width;
		// no need for saveCanvas to be resized - it is resized anyway whenever it is used to selection size
	}
	
	if (!isNaN(height) && height > 0) {
		// valid height value
		
		// round to brush size
		height = Math.ceil(height/Brush.size)*Brush.size;
		
		// resize canvases
		Els.editor.height = height;
		Els.transparency.height = height;
		// no need for saveCanvas to be resized - it is resized anyway whenever it is used to selection size
	}
	
	// update varibles etc.
	init();
	
	Ctx.editor.fillStyle = Els.colorWell.value;
}

//
// Undo Redo
//

function undo() {
	if (undoArray.length > 1) {
		// there is something to undo
		
		// draw the image data
		// undo[undo.length - 1] is the current image
		drawImageData(undoArray[undoArray.length - 2]);
		
		// move the last element of undo to redo and deep copy it
		let toRedo = deepCopyImageData(undoArray.pop());
		
		redoArray.push(toRedo);
			
		// deep copy undo array (pop breaks deep copy)
		undoArray = undoArray.map(function(arr) {
			return deepCopyImageData(arr);
		});
	}
}

function redo() {
	if (redoArray.length > 0) {
		// there is something to redo
		
		// draw the image data
		drawImageData(redoArray[redoArray.length - 1]);
		
		// move the last element of redo to undo and deep copy it
		let toUndo = deepCopyImageData(redoArray.pop());
		
		undoArray.push(toUndo);
			
		// deep copy redo array and its elements of 2d arrays (pop breaks deep copy)
		redoArray = redoArray.map(function(arr) {
			return deepCopyImageData(arr);
		});
	}
}

//
// Image data functions
//

// find approx ImageData size: https://stackoverflow.com/a/11900218/9713957

function setImageData(position, value) {
	ImageData[position.col][position.row] = value;
}

// draw the image data parameter onto the canvas
function drawImageData(data) {
	// check parameter is not null
	if (data !== null) {
		clearCanvas(false);
		
		for (let col = 0; col < data.length; col++) { // iterate through columns
			for (let row = 0; row < data[col].length; row++) { // iterate through rows
				if (data[col][row] !== undefined && data[col][row] !== null) {
					// not a transparent pixel
					// set fill colour
					Ctx.editor.fillStyle = data[col][row];
					// 16 is the default brush size (size stored by ImageData)
					Ctx.editor.fillRect(col * 16, row * 16, 16, 16);
				}
			}
		}
		
		// update image data
		ImageData = data;
		
		// save to local storage if user has setting enabled (so they can refesh and it is still there)
		saveCurrentArt();
		
		// reset fill colour to what it was
		Ctx.editor.fillStyle = Brush.color;
	}
}

// draw the image data parameter onto the canvas
// also resizes canvas to size of image data, and re-inits canvas (e.g. removes undo and redo history)
// init = if it was called on init
function importImageData(data, init) {
	// check parameter is not null
	if (data !== null) {
		// resize the canvas to the imagedata's size
		// also re-inits the canvas
		resizeCanvas(data.length * 16, data[0].length * 16);
		
		// now draw the image data on the canvas
		for (let col = 0; col < data.length; col++) { // iterate through columns
			for (let row = 0; row < data[col].length; row++) { // iterate through rows
				if (data[col][row] !== undefined && data[col][row] !== null) {
					// not a transparent pixel
					// set fill colour
					Ctx.editor.fillStyle = data[col][row];
					// 16 is the default brush size (size stored by ImageData)
					Ctx.editor.fillRect(col * 16, row * 16, 16, 16);
				}
			}
		}
		
		// update image data
		ImageData = data;
		
		if (init === false) { // if init is true, importImageData was called by saved local art - do not save again
			// save to local storage if user has setting enabled (so they can refesh and it is still there)
			saveCurrentArt();
		}
		
		// reset fill colour to what it was
		Ctx.editor.fillStyle = Brush.color;
	}
}

// returns a deep copy of the 2d array parameter (so it does not change when in undoArray/redoArray)
function deepCopyImageData(data) {
	data = data.map(function(arr) {
		return arr.slice();
	});
	
	return data;
}

//
// JSON array functions (for local store saving of image data)
//

// JSON stringify for multidimensional array
// note that the parameter's variable is changed as well (deep copy to stop that from happening)
function stringifyArray(array) {
	let obj = {};
	array.forEach((element, i) => {
		if (element === undefined || element === null) {
			// transparent pixel
			obj[i] = null;
		}
		else if (element.constructor === Array) {
			// element is an array
			// for multidimensional arrays
			obj[i] = stringifyArray(element);
		}
		else {
			obj[i] = element;
		}
	});
	
	return JSON.stringify(obj);
}

// JSON parse for multidimensional array (for use with stringifyArray)
function parseArray(json) {
	// parse the stringified object into an object
	let obj = JSON.parse(json);
	
	if (obj !== null) {
		let arr = [];
		// convert object to array
		Object.keys(obj).forEach(key => {
			// in case the property should be another object (for multi-dimensional arrays), parse contents
			// the parsed version is not saved to the array directly since parseArray will parse it anyway when it is called recursively
			let contents;
			try {
				// try catch used because the contents might not always be valid JSON
				contents = JSON.parse(obj[key]);
			}
			catch (e) {
				contents = null;
			}
			
			if (typeof contents === "object" && contents !== null) {
				// element is an object
				// for multidimensional arrays
				arr.push(parseArray(obj[key]));
			}
			else {
				arr.push(obj[key]);
			}
		});
		return arr;
	}
	return json;
}

//
// Export and import art from JSON
//

// stringify metadata and imageData from parameter
function stringifyArtObject(art) {
	let artJSON = art;
	
	// deep copy to avoid the parameter's variable being changed as well
	let copiedArray = deepCopyImageData(artJSON.imageData);
	artJSON.imageData = stringifyArray(copiedArray);
	
	artJSON = JSON.stringify(artJSON);
	
	return artJSON;
}

// convert the whole image to JSON (inc. metadata)
function getArtJSON() {
	let artName = Els.artNameInput.value;
	let authorName = Els.authorInput.value;
	let date = getDate();
	
	let artJSON = {};
	artJSON.metadata = {
		name: artName,
		author: authorName,
		editorVersion: EditorVersion,
		date: date,
	};
	artJSON.imageData = ImageData;
	
	artJSON = stringifyArtObject(artJSON);
	
	return artJSON;
}

// parse art JSON
function parseArtJSON(artJSON) {
	if (artJSON !== null) {
		artJSON = JSON.parse(artJSON);
		
		artJSON.imageData = parseArray(artJSON.imageData);
		
		return artJSON;
	}
	return artJSON;
}

// parse an array of art JSONs (from local storage saving of art)
// art JSON = object of metadata and imageData
// this must be the raw JSON - the outer level array should not have yet been parsed
function parseArtArray(artArray) {
	// parse top-level array of art with JSON.parse into object
	artArray = JSON.parse(artArray);
	// check it is an object
	if (artArray !== null && typeof artArray === "object") {
		// now convert object to array
		artArray = Object.values(artArray);
		// now parse object contents and .imageData so it can be accessed
		for (let i = 0; i < artArray.length; i++) {
			artArray[i] = JSON.parse(artArray[i]);
			artArray[i].imageData = parseArray(artArray[i].imageData)
		}
	}
	
	return artArray;
}

// stringify an array of art datas (for local storage saving of art)
// art data = object of metadata and imageData
function stringifyArtArray(artArray) {
	let jsonArray = [];
	
	// parse art objects first
	for (let i = 0; i < artArray.length; i++) {
		// check it is object (some elements might already be stringified)
		if (artArray[i] !== null && typeof artArray[i] === "object") {
			// is object (thus should be stringified)
			jsonArray.push(stringifyArtObject(artArray[i]));
		}
		else {
			jsonArray.push(artArray[i]);
		}
	}
	
	if (jsonArray.length === 0) {
		jsonArray = JSON.stringify(null);
	}
	else {
		jsonArray = stringifyArray(jsonArray); // stringify to object
	}
	
	return jsonArray;
}

// return function that loads the imageData at the parameter
function createArtLoadOnclick(imageData, metadata) {
	return function () {
		// import the imageData
		importImageData(imageData);
		importMetadata(metadata);
		// close the import art page
		Els.loadArtLocalWrapper.hidden = true;
	}
}

// load art from its JSON
function loadArtJSON(json) {
	let obj = parseArtJSON(json);
	importImageData(obj.imageData);
	importMetadata(obj.metadata);
}

// return function that deletes art of name in parameter from local storage
function createArtDeleteOnclick(artName) {
	return function () {
		// confirm they want to delete it
		if (confirm("Are you sure you want to delete the art '" + artName + "'?")) {
			// get art array
			let artArray = parseArtArray(localStorage.getItem("savedArt"));
			// find and delete the art
			// art can be parsed like this since art itself does not need to be accessed (only metadata)
			let index = artArray.findIndex(art => art.metadata.name === artName);
			artArray.splice(index, 1);
			// update local storage
			localStorage.setItem("savedArt", stringifyArtArray(artArray));
			// refresh the art import page
			loadArtLocalMenuUpdate(artArray);
		}
	}
}

//
// Local storage functions
//

// confirms that local storage is turned on, returning true if it is
function confirmLocalStorage() {
	if (Els.localStoreEnabled.checked) {
		// local storage enabled
		return true;
	}
	// local storage is not enabled
	alert("You must turn on local storage to use this feature.");
	return false;
}

// set the local storage radio button to whatever was chosen previously by user
function setLocaStorageSetting() {
	if (localStorage.getItem("enabled") === "yes") {
		Els.localStoreEnabled.checked = true;
	}
}

// save the art on the canvas to local storage so it is there if they refresh
// called every time something is changed on canvas
// note that undo/redo information is not saved (TBD tell this to user)
function saveCurrentArt() {
	if (Els.localStoreEnabled.checked) {
		// local storage enabled
		localStorage.setItem("currentArt", getArtJSON()); // saves even if metadata has not been set
		// metadata is saved so this can be recalled on loading current art
	}
}

// load and draw the art that was saved to be on canvas
function loadCurrentArt() {
	if (Els.localStoreEnabled.checked) {
		// local storage enabled
		// draw the image and set image data
		let newArt = parseArtJSON(localStorage.getItem("currentArt"));
		if (newArt !== null) {
			// import the image data
			importImageData(newArt.imageData, true);
			// import the metadata
			importMetadata(newArt.metadata);
		}
	}
}

// save the art to local storage
// called by the setting button
function saveArtLocal() {
	if (confirmLocalStorage()) {
		// local storage enabled
		
		if (confirmMetadata(saveArtLocal)) {
			// metadata is fine
			
			// get the art's JSON
			// stringifyArtArray ignores that this is already JSON (doesn't matter)
			let artJSON = getArtJSON();
			
			// get saved art array
			// completely parsing it helps with stringifyArtArray
			let artArray = parseArtArray(localStorage.getItem("savedArt"));
			if (artArray === null) {
				// has not been initialised yet
				artArray = [];
			}
			
			artArray.push(artJSON);
			
			// update local storage
			localStorage.setItem("savedArt", stringifyArtArray(artArray));
			
			// friendly alert
			alert("Art saved successfully!");
		}
		
	}
}

//
// Metadata setting and confirming
//

// confirm that valid metadata has been set, returning true if it has been
// callback is the function that is called after the metadata has been set
// callback should be undefined if there is no callback
function confirmMetadata(callback) {
	let artName = Els.artNameInput.value;
	let authorName = Els.authorInput.value;
	
	if (artName === "" || authorName === "") {
		// make them set the metadata first
		alert("You must enter metadata for the art first.");
		// reopen the old page after
		afterMetadataClose = callback;
		// open the page
		Els.metadataWrapper.hidden = false;
		
		return false;
	}
	return true;
}

// called when metadata is closed
// calls the metadata callback
function metadataClosed() {
	// close the page
	Els.metadataWrapper.hidden = true;
	
	// save the changed metadata
	saveCurrentArt();
	
	// call any function that should now be called
	if (afterMetadataClose !== undefined) {
		let callback = afterMetadataClose;
		afterMetadataClose = undefined;
		callback();
	}
}

// load metadata from an object containing name and author
function importMetadata(metadataObj) {
	Els.artNameInput.value = metadataObj.name;
	Els.authorInput.value = metadataObj.author;
}

// returns date and time string for metadata
function getDate() {
	let dateString = "";
	let d = new Date();
	
	let date = d.getDate();
	if (date < 10) {
		date = "0" + date;
	}
	dateString += date + "/";
	
	let month = d.getMonth() + 1; // months start at 0
	if (month < 10) {
		month = "0" + month;
	}
	dateString += month + "/";
	dateString += d.getFullYear() + ", ";
	
	let hours = d.getHours();
	if (hours < 10) {
		hours = "0" + hours;
	}
	dateString += hours + ":";
	
	let mins = d.getMinutes();
	if (mins < 10) {
		mins = "0" + mins;
	}
	dateString += mins;
	
	return dateString;
}

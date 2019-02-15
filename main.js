EditorVersion = "0.2.0"

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
	Els.saveArtLocalWrapper = document.querySelector("#saveArtLocalWrapper"); // save art wrapper (hidden until save art to local storage)
	Els.loadArtLocalWrapper = document.querySelector("#loadArtLocalWrapper"); // load art wrapper (hidden until load art to local storage)
	
	// settings
	Els.toolButtons = document.getElementsByName('tool'); // tool setting radio buttons
	Els.colorWell = document.querySelector("#colorWell"); // color well
	Els.localStoreEnabled = document.querySelector("#localStoreEnabled"); // local storage on setting
	
	// metadata inputs
	Els.artNameInput = document.querySelector("#artNameInput"); // art name
	Els.authorInput = document.querySelector("#authorInput"); // author name
	
	// load from local storage output
	Els.savedArtList = document.querySelector("#savedArtList"); // list of saved art
	
	
	
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
	
	// save blank image data to local storage if the setting is enabled
	saveCurrentArt();
	
	// reset undo and redo
	undoArray = [];
	redoArray = [];
	
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

// open and re-init local storage export menu
function saveArtLocalMenu(canvas) {
	if (Els.localStoreEnabled.checked) {
		// local storage enabled
		
		// delete what is in the input fields
		Els.artNameInput.value = "";
		Els.authorInput.value = "";
		
		// show the whole wrapper
		Els.saveArtLocalWrapper.hidden = false;
	}
	else {
		// local storage is not enabled
		alert("You must turn on local storage to use this feature.");
	}
}

// open and init local storage inport menu
function loadArtLocalMenu(canvas) {
	if (Els.localStoreEnabled.checked) {
		// local storage enabled
		
		// parse the array of saved art so .metadata and .imageData can be accessed for each element
		let savedArtArray = parseArtArray(localStorage.getItem("savedArt"));
		
		if (savedArtArray !== null) {
			// art has been saved before
			
			// wipe the previously generated saved art list
			Els.savedArtList.innerHTML = "";
			
			// now add art to the saved art list from the saved art array
			for (let i = 0; i < savedArtArray.length; i++) {
				// add onClick to load the art
				let listElement = document.createElement('li');
				listElement.onclick = createArtLoadOnclick(savedArtArray[i].imageData);
				listElement.appendChild(document.createTextNode(savedArtArray[i].metadata.name));
				Els.savedArtList.appendChild(listElement);
			}
			
			// show the whole wrapper
			Els.loadArtLocalWrapper.hidden = false;
		}
		else {
			// no need to open menu since nothing has been saved
			alert("You have no local saved art to load!");
		}
	}
	else {
		// local storage is not enabled
		alert("You must turn on local storage to use this feature.");
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
function importImageData(data, init) {
	// check parameter is not null
	if (data !== null) {
		// resize the canvas to the imagedata's size
		// also re-iinits the canvas
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
		
		if (init === true) { // importImageData was called by saved local art - do not save again
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

// convert the whole image to JSON (inc. metadata)
// parameters are for metadata
function getArtJSON(name, author) {
	let artJSON = {};
	artJSON.imageData = stringifyArray(ImageData);
	artJSON.metadata = {
		name: name,
		author: author,
		editorVersion: EditorVersion,
	};
	
	artJSON = JSON.stringify(artJSON);
	
	return artJSON;
}

// get the image data from JSON
function getImageDataJSON(artJSON) {
	artJSON = JSON.parse(artJSON);
	
	let imageData = parseArray(artJSON.imageData);
	
	return imageData;
}

// parse an array of art JSONs (from local storage saving of art)
function parseArtArray(artArray) {
	if (artArray !== null) {
		// parse top-level array of art with JSON.parse into object
		artArray = JSON.parse(artArray);
		// now convert object to array
		artArray = Object.values(artArray);
		// now parse all of these so that .metadata and .imageData can be accessed
		for (let i = 0; i < artArray.length; i++) {
			artArray[i] = JSON.parse(artArray[i]);
			// also parse the .imageData array (multidimensional) as well
			artArray[i].imageData = parseArray(artArray[i].imageData)
		}
	}
	
	return artArray;
}

// return function that loads the imageData at the parameter
function createArtLoadOnclick(imageData) {
	return function () {
		// import the imageData
		importImageData(imageData);
		// close the import art page
		Els.loadArtLocalWrapper.hidden = true;
	}
}

//
// Local storage functions
//

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
		localStorage.setItem("currentArt", stringifyArray(ImageData));
	}
}

// load and draw the art that was saved to be on canvas
function loadCurrentArt() {
	if (Els.localStoreEnabled.checked) {
		// local storage enabled
		// draw the image and set image data
		importImageData(parseArray(localStorage.getItem("currentArt")), true);
	}
}

// save the art to local storage (called after the metadata menu has been opened)
function saveArtLocal() {
	let artName = Els.artNameInput.value;
	let authorName = Els.authorInput.value;

	// get the art's JSON
	let artJSON = getArtJSON(artName, authorName);
	
	// get the saved art array from local storage
	// just stringifies the array itself
	let savedArtArray = JSON.parse(localStorage.getItem("savedArt"));
	if (savedArtArray === null) {
		// has not been initialised yet
		savedArtArray = [];
	}
	
	savedArtArray.push(artJSON);
	
	// save the updated array back to local storage
	localStorage.setItem("savedArt", JSON.stringify(savedArtArray));
	
	// close the page
	Els.saveArtLocalWrapper.hidden = true;
}

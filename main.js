const EditorVersion = "0.6.0";

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
	Els.overlay = document.querySelector("#overlay"); // overlay canvas (where save selection darkening is drawn)
	Els.saveCanvas = document.querySelector("#saveCanvas"); // image save canvas (always hidden)
	Els.template = document.querySelector("#template"); // template canvas

	// hidden elements (shown when a certain menu is opened)
	Els.savedImageWrapper = document.querySelector("#savedImageWrapper"); // save art wrapper (hidden unless saved art is shown)
	Els.loadArtLocalWrapper = document.querySelector("#loadArtLocalWrapper"); // load art wrapper (hidden until load art to local storage)
	Els.metadataWrapper = document.querySelector("#metadataWrapper"); // metadata wrapper (hidden until art metadata is changed)
	Els.loadArtJSONWrapper = document.querySelector("#loadArtJSONWrapper"); // file upload screen
	Els.updateWrapper = document.querySelector("#updateWrapper"); // load art wrapper (hidden until load art to local storage)
	Els.uploadTemplateWrapper = document.querySelector("#uploadTemplateWrapper"); // file upload screen

	// settings
	Els.toolButtons = document.getElementsByName("tool"); // tool setting radio buttons
	Els.colorWell = document.querySelector("#colorWell"); // color well
	Els.colorHexInput = document.querySelector("#colorHexInput"); // hexadecimal input of color
	Els.brushSizeSelect = document.querySelector("#brushSizeSelect"); // brush size
	Els.localStoreEnabled = document.querySelector("#localStoreEnabled"); // local storage on setting
	// texturer
	Els.texturerCheckbox = document.querySelector("#texturerCheckbox"); // on or off
	Els.texturerDepth = document.querySelector("#texturerDepth"); // number input - amount to texture by

	// template
	Els.templateInput = document.querySelector("#templateInput");
	Els.templateInput.addEventListener('change', uploadTemplate, false);
	Els.templateTransparency = document.querySelector("#templateTransparency");

	// metadata inputs
	Els.artNameInput = document.querySelector("#artNameInput"); // art name
	Els.authorInput = document.querySelector("#authorInput"); // author name

	// load from local storage output
	Els.savedArtList = document.querySelector("#savedArtList"); // list of saved art

	// upload JSON file input
	Els.artInput = document.querySelector("#artInput");

	// tool radio button elements
	Els.toolBrush = document.querySelector("#toolBrush");
	Els.toolFill = document.querySelector("#toolFill");
	Els.toolEraser = document.querySelector("#toolEraser");
	Els.toolEraserFill = document.querySelector("#toolEraserFill");
	Els.toolColorPicker = document.querySelector("#toolColorPicker");



	// canvas context
	Ctx.editor = Els.editor.getContext('2d');
	Ctx.transparency = Els.transparency.getContext('2d');
	Ctx.overlay = Els.overlay.getContext('2d');
	Ctx.template = Els.template.getContext('2d');

	// brush
	Tool = "brush";
	Brush.color = Els.colorWell.value; // default color
	Els.brushSizeSelect.addEventListener("change", updateBrushSize, false);

	init();

	// update the brush color upon color change
	Els.colorWell.addEventListener("change", updateColor, false);
	Els.colorWell.select();
	Els.colorHexInput.addEventListener("change", updateColor, false);

	// local storage
	setLocaStorageSetting(); // radio button
	loadCurrentArt(); // load art if setting is on

	// canvas event listeners (for painting)
	// added to overlay because it is on top
	Els.overlay.addEventListener("mousemove", paint); // paint tile if mouse is moved (checks if mouse is down)
	Els.overlay.addEventListener("mousedown", mouseDown); // mouse set to down
	Els.overlay.addEventListener("mouseup", mouseUp); // mouse set to up
	Els.overlay.addEventListener("mouseout", mouseUp); // also set mouse to up when user leaves the canvas with mouse

	// hotkeys
	document.addEventListener("keydown", function (event) {
		switch (event.key) {
			case "z":
	        	// undo
				if (event.ctrlKey) {
					undo();
				}
				break;

			case "y":
	        	// redo
				if (event.ctrlKey) {
					redo();
				}
				break;

			case "s":
				// save
				if (event.ctrlKey) {
					if (event.altKey) {
						// selection
						saveArtSelection();
					}
					else {
						// whole thing
						saveArt(Els.editor);
					}
					// avoid it being
					event.preventDefault();
				}
				break;

			// tools

			case "1":
	        	// brush
				Els.toolBrush.checked = true;
				break;

			case "2":
	        	// fill
				Els.toolFill.checked = true;
				break;

			case "3":
	        	// eraser
				Els.toolEraser.checked = true;
				break;

			case "4":
	        	// eraser fill
				Els.toolEraserFill.checked = true;
				break;

			case "5":
	        	// color picker
				Els.toolColorPicker.checked = true;
				break;

			case "6":
	        	// texturer
				Els.texturerCheckbox.checked = !Els.texturerCheckbox.checked;
				break;
		}
	});
}

//
// Init new canvas (called every time a new canvas is created, e.g. canvas resized)
//

function init() {
	updateBrushSize(); // set canvas size variables, set brush.size value, and draw transparency grid
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

// fill transparency grid background (grey and white)
// called on init and whenever brush size changes
function drawTransparency() {
	// clear canvas
	Ctx.transparency.clearRect(0, 0, Els.transparency.width, Els.transparency.height);

	// set color for drawing
	Ctx.transparency.fillStyle = "#eeeeee"; // tbd more specific color?

	let cols = Els.editor.width / Brush.size;
	let rows = Els.editor.height / Brush.size;

	// for loops to draw squares in checkerboard pattern
	for (let col = 0; col < cols; col++) {
		for (let row = col % 2; row < rows; row += 2) {
			// +=2 to make every other square grey
			// starting position alternates between 0 and 1
			Ctx.transparency.fillRect(col * Brush.size, row * Brush.size, Brush.size, Brush.size);
			// +1 so border is not drawn on
		}
	}
}

// initialise art variable as a transparent canvas
// imageData[x][y] gets the (x,y) coord in imageData
function initImageData() {
	ImageResolution = 16;

	// reset imageData
	ImageData = [];

	let cols = Els.editor.width / 16;
	let rows = Els.editor.height / 16;

	for (let col = 0; col < cols; col++) {
		let foo = [];
		for (let row = 0; row < rows; row++) {
			foo[row] = undefined; // undefined = transparent
		}
		ImageData[col] = foo;
	}
}

//
// Global variable definition
//

var ImageData = [];

var ImageResolution = 16; // resolution of image data (brush size for each element)

var Brush = {};

var Tool = "";

var Els = {}; // elements

var Ctx = {}; // canvas contexts

var mouseIsDown = false; // set to false when mouse is up (on editor canvas) and true when it is down

var saving = false; // set to the save dimensions when the image is in the process of being saved

var undoArray = []; // array of previous canvas state ImageDatas (saved on mouse up)
var redoArray = []; // array of future canvas state ImageDatas (added to by undo function and wiped on mouse down)
// the empty image data is added to undoArray by the init function

var afterMetadataClose; // set to a function that should be called after metadata is closed

var previousPaintedTile = {}; // set to the tile that was last painted (row and col)

var texturedTiles = []; // records textured tiles and their colors at the start of each fill, to make sure texturing size is even across fill

//
// Event listener functions
//

// called on mouse down
function mouseDown(event) {
	mouseIsDown = true; // set to down

	if (saving !== false) {
		// saving selection
		if (saving.startPos === undefined) {
			let position = findTileAtMouse(event, Brush.size);

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

		// paint should not be called if the action does not occur on mouse dragging
		if (Tool === "colorPicker") {
			// set color to picked color
			// 4 is used as the brush size so that resolution doesn't matter
			setColor(getTileAtMouse(event));
		}
		else if (Tool === "fill" || Tool === "eraserFill") {
		// 4 is used as the brush size so that resolution doesn't matter
			fillStart(findTileAtMouse(event, 4));
		}
		else {
			paint(event); // initial paint tile (for click)
			// note paint is also called on mouse drag, and subsequently calls either setTile or eraseTile
		}
	}
}

// called on mouse up or leave
function mouseUp(event) {
	mouseIsDown = false; // set to up

	if (saving !== false && saving.startPos !== undefined) {
		// saving selection

		// save finish position for saving
		let position = findTileAtMouse(event, Brush.size);
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
		let imageWidth = finishPos.col * Brush.size - clippingX + Number(Brush.size);
		let imageHeight = finishPos.row * Brush.size - clippingY + Number(Brush.size);
		// set size of save canvas
		Els.saveCanvas.width = imageWidth;
		Els.saveCanvas.height = imageHeight;
		// draw the image onto the save canvas
		Els.saveCanvas.getContext('2d').drawImage(Els.editor, clippingX, clippingY, imageWidth, imageHeight, 0, 0, imageWidth, imageHeight);
		saveArt(Els.saveCanvas);
	}

	else if (Tool !== "colorPicker") {
		// not saving nor colorpicking hence art has been changed; save this version of the art to undoArray

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

// set brush color (called from color picker element with event object)
function updateColor(event) {
	setColor(event.target.value);
}

// set brush color
function setColor(color) {
	// test color is a hexadecimal value
	let regExp = new RegExp(/^#[0-9A-F]{6}$/i);
	if (regExp.test(color)) {
		// is a hex value
		Brush.color = color;
		Els.colorWell.value = color; // update value shown on color well
		Els.colorHexInput.value = color; // update value in hexadecimal input
		// canvas fill color is updated on every tile set (to allow for texturer to work if it is enabled)
	}
}

// update brush size and transparency background
function updateBrushSize() {
	Brush.size = Els.brushSizeSelect.options[Els.brushSizeSelect.selectedIndex].value; // brush size
	drawTransparency(); // background
}

// init art selection save
function saveArtSelection() {
	// check that nothing is being currently saved
	if (saving === false) {
		saving = {}; // ready for startPos and finishPos to be saved, in the format of an object with row and col parameters

		// fill in overlay canvas
		Ctx.overlay.globalAlpha = 0.3;
		Ctx.overlay.fillRect(0, 0, Els.overlay.width, Els.overlay.height);
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

		// clear overlay canavs
		Ctx.overlay.clearRect(0, 0, Els.overlay.width, Els.overlay.height);
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

// open and init local storage import menu
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
		let filename = Els.artNameInput.value + ".json";
		let blob = new Blob([artJSON], {type: "text/plain"});
		if (window.navigator && window.navigator.msSaveOrOpenBlob) {
			window.navigator.msSaveOrOpenBlob(blob, filename);
		}
		else {
			let e = document.createEvent("MouseEvents");
			let a = document.createElement("a");
			a.download = filename;
			a.href = window.URL.createObjectURL(blob);
			a.dataset.downloadurl = ["text/plain", a.download, a.href].join(":");
			e.initEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
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
// Tile finding functions
//

// take into account scrolled viewport and moved canvas
function getMouseCoords(event) {
	let rect = Els.editor.getBoundingClientRect();
	let x = event.clientX - rect.left;
	let y = event.clientY - rect.top;
	return {x: x, y: y};
}

// find tile to draw, based on mouse position
// returns object with properties col (column) and row
// based on brush size (returns col and row in the transparency grid)
// resolution = brush size (detail to look at the canvas)
function findTileAtMouse(event, resolution) {
	let mouseCoords = getMouseCoords(event);
	return findTileAtCoords(mouseCoords.x, mouseCoords.y, resolution);
}

// find tile at coordinates
// returns object with properties col (column) and row
// based on brush size (returns col and row in the transparency grid)
// resolution = brush size (detail to look at the canvas)
function findTileAtCoords(x, y, resolution) {
	let col = Math.floor(x / resolution);
	let row = Math.floor(y / resolution);
	return {col: col, row: row};
}

// get the contents of the tile at the mouse's position
// resolution used is the smallest possible (4)
function getTileAtMouse(event) {
	return getTile(findTileAtMouse(event, 4), 4);
}

// get the contents of the tile at a specific position (row col object from findTile)
// note that this could return an object if the brush's size is larger than the resolution of the tile
// resolution = resolution used to generate tile
function getTile(position, resolution) {
	let sizeFactor = resolution/ImageResolution; // used to find x and y in imageData

	let imageDataX = position.col * sizeFactor;
	let imageDataY = position.row * sizeFactor;

	// indices in imageData that the pixel can be found within
	let indexX = Math.floor(imageDataX);
	let indexY = Math.floor(imageDataY);

	let imageDataMultiplier = 1; // used to calculate which array to index into, incrememented by factors of 2 in while loop

	let pixel = ImageData[indexX][indexY];

	// repeat until resolution of returned tile is equal to resolution (for smaller brush sizes within a pixel)
	for (let size = 16; size > resolution; size /= 2) {
		if (Array.isArray(pixel)) {
			// still more that can be indexed into

			// find whether selected pixel is in top/bottom left/right of "pixel" variable
			let pixelLocation;
			if (imageDataY % (1/imageDataMultiplier) < 0.5 / imageDataMultiplier) {
				// top
				pixelLocation = 0;
			}
			else {
				// bottom
				pixelLocation = 2;
			}
			if (imageDataX % (1/imageDataMultiplier) < 0.5 / imageDataMultiplier) {
				// left
			}
			else {
				// right
				pixelLocation++;
			}

			pixel = pixel[pixelLocation];

			imageDataMultiplier *= 2;
		}
		else {
			break;
		}
	}

	return pixel;
}

// returns true or false depending on if the tile is on the canvas
// position is an object in the same format as the one returned by findTile functions (varies based on brush size)
// resolution = resolution used to generate position (in findTile)
function tileIsOnCanvas(position, resolution) {
	let sizeFactor = resolution / ImageResolution;
	// indices in image data it can be found in
	let imageDataX = Math.floor(position.col * sizeFactor);
	let imageDataY = Math.floor(position.row * sizeFactor);

	if (ImageData.hasOwnProperty(imageDataX) && ImageData[imageDataX].hasOwnProperty(imageDataY)) {
		return true;
	}
	return false;
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
		let position = findTileAtMouse(event, Brush.size);
		// make sure that last tile painted is not the current tile, and that tile is on canvas
		if ((position.col !== previousPaintedTile.col || position.row !== previousPaintedTile.row) && tileIsOnCanvas(position, Brush.size)) {

			// only paint when the image is not being saved and a saved image is not shown
			if (saving === false) {
				if (Tool === "brush") {
					// set the tile's color
					setTile(position, Brush.size);
				}
				else if (Tool === "eraser") {
					// erase the tile
					eraseTile(position, Brush.size);
				}
			}
			else {
				// change display on overlay canvas to show currently saved area
				Ctx.overlay.clearRect(0, 0, Els.overlay.width, Els.overlay.height);
				Ctx.overlay.fillRect(0, 0, Els.overlay.width, Els.overlay.height);
				// code used to find position and width is same as the code in mouseUp
				let startPos = {
					col: Math.min(saving.startPos.col, position.col),
					row: Math.min(saving.startPos.row, position.row),
				};
				let finishPos = {
					col: Math.max(saving.startPos.col, position.col),
					row: Math.max(saving.startPos.row, position.row),
				};
				let startX = startPos.col * Brush.size;
				let startY = startPos.row * Brush.size;
				let finishX = finishPos.col * Brush.size;
				let finishY = finishPos.row * Brush.size;
				let width = finishX - startX + Number(Brush.size);
				let height = finishY - startY + Number(Brush.size);
				Ctx.overlay.clearRect(startX, startY, width, height);
			}

			previousPaintedTile = position;
		}
	}
}

// sets a tile and renders this change onto the editor canvas
// position is from findTile functions
function setTile(position, size) {
	// set color
	if (Els.texturerCheckbox.checked) {
		// texturer
		if (Tool !== "fill" || size >= 16) {
			Ctx.editor.fillStyle = textureColor(Brush.color, Els.texturerDepth.value);
		}
		else {
			// fill tool with size < 16
			// texturing size should be even throughout no matter what brush size is

			// convert position from small brush size to normal
			let sizeFactor = size/ImageResolution;
			let indexX = Math.floor(position.col * sizeFactor);
			let indexY = Math.floor(position.row * sizeFactor);

			// check if last textured tile has been textured before this fill
			let foundTile = texturedTiles.find(tile => tile.position.x === indexX && tile.position.y === indexY);
			if (foundTile !== undefined) {
				// has been textured before, thus do same color
				Ctx.editor.fillStyle = foundTile.color;
			}
			else {
				// different one, pick a new texture color
				Ctx.editor.fillStyle = textureColor(Brush.color, Els.texturerDepth.value);
				// record color for future tiles filled by this fill
				texturedTiles.push({
					position: {
						x: indexX,
						y: indexY
					},
					color: Ctx.editor.fillStyle
				});
			}
		}
	}
	else {
		// no texturer
		Ctx.editor.fillStyle = Brush.color;
	}

	// update imagedata
	setImageData(position, Ctx.editor.fillStyle, size);

	// draw change onto editor canvas
	Ctx.editor.fillRect(position.col * size, position.row * size, size, size);
}

// position should contian the col and row of the fill location (from findTileAtMouse())
// position passed ni is with resolution 4
function fillStart(position) {
	let colorBeingFilled = getTile(position, 4); // all tiles of this color within a boundary will be filled
	if ((colorBeingFilled !== Brush.color && Tool === "fill") || Els.texturerCheckbox.checked || (colorBeingFilled !== undefined && Tool === "eraserFill")) {
		// not trying to fill color that is already there

		// calculate less accurate fill position (since filling happens with size 16)
		let fillPosition = {
			col: Math.floor(position.col/4),
			row: Math.floor(position.row/4)
		};

		if (Els.texturerCheckbox.checked) {
			// texturing will occur in fill
			// to ensure size of texturing remains constant, textured tiles of size 16 are saved
			texturedTiles = [];
		}

		fill(fillPosition, undefined, colorBeingFilled, 16);
	}
}

// recursion function for fillStart (should only be called by fillStart)
// direction is the direction that the fill came from, so it knows not to start a new fill in the opposite direction (i.e. where it came from)
// direction 1 = right, 4 = up, moving clockwise...
// color is the colors that should be replaced by this fill
// size is the size of the fill (this is decremented by a factor of 2 when an array of smaller colors is reached)
function fill(position, direction, color, size) {
	// check tile is on the canvas
	if (tileIsOnCanvas(position, size)) {
		let tile = getTile(position, size);
		if (tile === color) {
			// tile is of correct color to be filled

			// set the tile to the brush color
			if (Tool === "fill") {
				// fill color
				setTile(position, size);
			}
			else if (Tool === "eraserFill") {
				// erase
				eraseTile(position, size);
			}

			// commence fill in other directions
			if (direction !== 1) {
				// fill left
				fill({
					col: position.col-1,
					row: position.row,
				}, 3, color, size);
			}
			if (direction !== 4) {
				// fill down
				fill({
					col: position.col,
					row: position.row+1,
				}, 2, color, size);
			}
			if (direction !== 3) {
				// fill right
				fill({
					col: position.col+1,
					row: position.row,
				}, 1, color, size);
			}
			if (direction !== 2) {
				// fill up
				fill({
					col: position.col,
					row: position.row-1,
				}, 4, color, size);
			}
		}
		// check for array of colors
		else if (Array.isArray(tile) && size > 4) {
			// resolution is higher than fill paint size
			// decrement size and try again in same location
			size /= 2;

			// update position
			position.row *= 2;
			position.col *= 2;
			// position is now top left

			// decide location in smaller tile based on direction it came from
			if (direction === 1) {
				// came from left
				fill({
					col: position.col,
					row: position.row,
				}, 3, color, size);
				fill({
					col: position.col,
					row: position.row+1,
				}, 3, color, size);
			}
			else if (direction === 4) {
				// came from down
				fill({
					col: position.col,
					row: position.row+1,
				}, 2, color, size);
				fill({
					col: position.col+1,
					row: position.row+1,
				}, 2, color, size);
			}
			else if (direction === 3) {
				// came from right
				fill({
					col: position.col+1,
					row: position.row,
				}, 3, color, size);
				fill({
					col: position.col+1,
					row: position.row+1,
				}, 3, color, size);
			}
			else if (direction === 2) {
				// came from up
				fill({
					col: position.col,
					row: position.row,
				}, 2, color, size);
				fill({
					col: position.col+1,
					row: position.row,
				}, 2, color, size);
			}
			else if (direction === undefined) {
				// fill initialised
				fill({
					col: position.col,
					row: position.row,
				}, 2, color, size);
				fill({
					col: position.col+1,
					row: position.row,
				}, 2, color, size);
				fill({
					col: position.col,
					row: position.row+1,
				}, 3, color, size);
				fill({
					col: position.col+1,
					row: position.row+1,
				}, 3, color, size);
			}
		}
		// if color was not the color to be replaced, this direction of the fill fizzles
	}
}

// sets a tile and renders this change onto the editor canvas
function eraseTile(position, size) {
	// update imagedata
	setImageData(position, undefined, size); // undefined = transparent

	// draw change onto editor canvas
	Ctx.editor.clearRect(position.col * size, position.row * size, size, size);
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
		Els.overlay.width = width;
		Els.template.width = width;
		// no need for saveCanvas to be resized - it is resized anyway whenever it is used to selection size
	}

	if (!isNaN(height) && height > 0) {
		// valid height value

		// round to brush size
		height = Math.ceil(height/Brush.size)*Brush.size;

		// resize canvases
		Els.editor.height = height;
		Els.transparency.height = height;
		Els.overlay.height = height;
		Els.template.height = height;
		// no need for saveCanvas to be resized - it is resized anyway whenever it is used to selection size
	}

	// update varibles etc.
	init();
}

//
// Texturer
//

// random integer between minimum and maximum (inclusive)
function randomNum (minimum, maximum) {
    return Math.floor((Math.random() * (maximum - minimum + 1)) + minimum);
}

// alter a color's hex code
// color should start with #
// depth = how much to alter it by (scale from 1 to 15)
function textureColor(color, depth) {
	// split into decimal rgb components
	let r = parseInt(color.substring(1, 3), 16);
	let g = parseInt(color.substring(3, 5), 16);
	let b = parseInt(color.substring(5), 16);

	// texture colors
	let random = randomNum(depth * -1, depth * 1); // textures all colors by the same amount
	r = Math.max(Math.min(r + random, 255), 0);
	g = Math.max(Math.min(g + random, 255), 0);
	b = Math.max(Math.min(b + random, 255), 0);

	// convert back to hex
	r = r.toString(16);
	g = g.toString(16);
	b = b.toString(16);
	if (r.length === 1) {
		r = "0" + r;
	}
	if (g.length === 1) {
		g = "0" + g;
	}
	if (b.length === 1) {
		b = "0" + b;
	}

	return "#"+r+g+b;
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
// Import
//

// called with (parsed) metadata and image data to be imported
function importArt(metadata, imageData) {
	// import brush size
	importBrushSize(metadata);
	// import the image data
	importImageData(imageData);
	// import the metadata
	importMetadata(metadata);
}

//
// Image data functions
//

// find approx ImageData size: https://stackoverflow.com/a/11900218/9713957

// position = from findTile functions
// value = color
// size = brush size
function setImageData(position, value, size) {
	let sizeFactor = size/ImageResolution; // bigger = more entries in ImageData need to be changed

	if (sizeFactor === 1) {
		// nothing else we need to do here
		ImageData[position.col][position.row] = value;
	}
	else {
		// convert row and col in editor grid to row and col in imageData
		let imageDataX = position.col * sizeFactor;
		let imageDataY = position.row * sizeFactor;

		// now handle based on if brush is bigger or smaller than resolution

		if (sizeFactor > 1) {
			// fill in multiple tiles
			// the new col and row (imageDataX and Y) are at the bottom-right of the squares being drawn in
			for (let x = imageDataX; x < imageDataX+sizeFactor; x++) {
				// iterate through x
				for (let y = imageDataY; y < imageDataY+sizeFactor; y++) {
					// iterate through y
					ImageData[x][y] = value;
				}
			}
		}

		else if (sizeFactor < 1) {
			// index in imageData will be split up into an array (if it hasn't already been)

			// indices in imageData that the pixel will be drawn in
			let indexX = Math.floor(imageDataX);
			let indexY = Math.floor(imageDataY);

			// array of indices (0-3) that pixel will be drawn in for imageData nested arrays
			// indexX and indexY are of course expections to the 0-3
			// e.g. ImageData[indexX][indexY][splitIndices[2]][splitIndices[3]]...[splitIndices[end]]
			let splitIndices = [indexX, indexY];

			let imageDataMultiplier = 1; // used to calculate splitIndices, incrememented by factors of 2 in while loop

			// repeat for each factor of 2 smaller, multiplying sizeFactor by 2 each loop
			// repeats until it has split it down enough
			while (sizeFactor < 1) {
				// find value that needs to be split up
				let valueToBeSplit = ImageData;
				for (let i = 0; i < splitIndices.length-1; i++) {
					valueToBeSplit = valueToBeSplit[splitIndices[i]];
				}

				// length -1 because we do not want to completely index into array
				// this is because we want to still keep a pointer to the initial array in the value we are editing

				// for the sake of brevity
				let finalSplitIndex = splitIndices[splitIndices.length-1];

				// split into 4 serparate elements if it hasn't been already
				if (!Array.isArray(valueToBeSplit[finalSplitIndex])) {
					// can be split
					let oldValue = valueToBeSplit[finalSplitIndex];
					valueToBeSplit[finalSplitIndex] = [oldValue, oldValue, oldValue, oldValue];
					// can now be accessed by ImageData[col][row][0-3]
					// [index 0, index 1]
					// [index 2, index 3]
				}


				// now find the new finalSplitIndex
				// find whether drawn pixel is in top/bottom left/right of this new array
				let furtherSplitIndex;
				if (imageDataY % (1/imageDataMultiplier) < 0.5 / imageDataMultiplier) {
					// top
					furtherSplitIndex = 0;
				}
				else {
					// bottom
					furtherSplitIndex = 2;
				}
				if (imageDataX % (1/imageDataMultiplier) < 0.5 / imageDataMultiplier) {
					// left
				}
				else {
					// right
					furtherSplitIndex++;
				}

				// push the index (0-3) that the drawn pixel is
				splitIndices.push(furtherSplitIndex);

				sizeFactor *= 2;
				imageDataMultiplier *= 2;
			}

			// set the pixel!
			let valueToBeSet = ImageData;
			for (let i = 0; i < splitIndices.length-1; i++) {
				valueToBeSet = valueToBeSet[splitIndices[i]];
			}

			// length -1 because we do not want to completely index into array
			// this is because we want to still keep a pointer to the initial array in the value we are editing

			// for the sake of brevity
			let finalSplitIndex = splitIndices[splitIndices.length-1];

			valueToBeSet[finalSplitIndex] = value;
		}
	}
}

// draw the image data parameter onto the canvas
// init = if it was called on init (called by importImageData)
function drawImageData(data, init) {
	// check parameter is not null
	if (data !== null) {
		if (!init) { // has already been cleared if init
			clearCanvas(false);
		}

		for (let col = 0; col < data.length; col++) { // iterate through columns
			for (let row = 0; row < data[col].length; row++) { // iterate through rows
				if (data[col][row] !== undefined && data[col][row] !== null) {
					// not a transparent pixel
					// set fill color
					Ctx.editor.fillStyle = data[col][row];

					if (Array.isArray(data[col][row])) {
						// smaller brush size than resolution of ImageData has been used
						drawSmallBrushSizeData(data[col][row], col * ImageResolution, row * ImageResolution, ImageResolution);
					}
					else {
						Ctx.editor.fillRect(col * ImageResolution, row * ImageResolution, ImageResolution, ImageResolution);
					}
				}
			}
		}

		// update image data
		ImageData = data;

		if (!init) { // if init is true, importImageData was called by saved local art - do not save again
			// save to local storage if user has setting enabled (so they can refesh and it is still there)
			saveCurrentArt();
		}
	}
}

// called by drawImageData (and itself)
// draw imageData where it has been split into an array for smaller brush sizes than its resolution
// data = the 4 element array (some of these elements could be further 4 element arrays, where recursion will be used)
// x and y are the positions of the top-left of the data parameter
// size is the width and height of the data paramenter (thus is divided by 2 for the individual array components)
function drawSmallBrushSizeData(data, x, y, size) {
	if (!Array.isArray(data) || data.length !== 4) {
		console.error("Invalid data parameter passed in to drawSmallBrushSizeData.");
	}
	else {
		for (let i = 0; i < data.length; i++) {
			// find x and y of "sub pixel" to be drawn
			// position from array index:
			// [0, 1]
			// [2, 3]
			let subPixelX = x;
			let subPixelY = y;
			if (i % 2 === 1) {
				// right
				subPixelX = x + size/2;
			}
			if (i > 1) {
				// bottom
				subPixelY = y + size/2;
			}

			if (Array.isArray(data[i])) {
				// run recursively to draw nested array
				drawSmallBrushSizeData(data[i], subPixelX, subPixelY, size/2)
			}
			else {
				// draw
				if (data[i] !== undefined && data[i] !== null) {
					// not a transparent color
					// set fill color
					Ctx.editor.fillStyle = data[i];
					Ctx.editor.fillRect(subPixelX, subPixelY, size/2, size/2);
				}
			}
		}
	}
}

// draw the image data parameter onto the canvas
// should be called AFTER importMetadata because ImageResolution must have been set
// also resizes canvas to size of image data, and re-inits canvas (e.g. removes undo and redo history)
// init = if it was called on init
function importImageData(data) {
	// check parameter is not null
	if (data !== null) {
		// resize the canvas to the imagedata's size
		// also re-inits the canvas
		resizeCanvas(data.length * ImageResolution, data[0].length * ImageResolution);

		drawImageData(data, true);
	}
}

// returns a deep copy of the 2d array parameter (so it does not change when in undoArray/redoArray)
function deepCopyImageData(data) {
	data = JSON.parse(JSON.stringify(data));

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
		resolution: ImageResolution,
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
		// import the imageData and metadata
		importArt(metadata, imageData);
		// close the import art page
		Els.loadArtLocalWrapper.hidden = true;
	}
}

// load art from its JSON
function loadArtJSON(json) {
	let obj = parseArtJSON(json);
	importArt(obj.metadata, obj.imageData);
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
			importArt(newArt.metadata, newArt.imageData);
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
// called after importImageData
function importMetadata(metadataObj) {
	Els.artNameInput.value = metadataObj.name;
	Els.authorInput.value = metadataObj.author;
}

// load brush size and resolution metadata from an object
// called before importImageData
function importBrushSize(metadataObj) {
	ImageResolution = "16";
	// update selected value in drop down list
	/*for (let i = 0; i < Els.brushSizeSelect.options.length; i++) {
		if (Els.brushSizeSelect.options[i].value === ImageResolution) {
			Els.brushSizeSelect.options[i].selected = true;
			break;
		}
	}*/
	// update brush size, transparency, etc.
	updateBrushSize();
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

//
// Template canvas
//

function clearTemplate () {
	Ctx.template.clearRect(0, 0, Els.template.width, Els.template.height);

	Els.templateInput.value = '';
}

// called by event listener of template image upload
function uploadTemplate (e) {
	// ty to https://stackoverflow.com/a/10906961/9713957
	let reader = new FileReader();
    reader.onload = function(event) {
        let img = new Image();
        img.onload = function() {
            Ctx.template.drawImage(img, 0, 0);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}

// called by event listener of template transparency update
// param is from 0 to 10 inc.
function templateTransparencyUpdate (transparency) {
	Els.template.style.opacity = transparency/10;
}

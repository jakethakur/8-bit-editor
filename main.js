//
// Setup
//

// start the program when the window has loaded
window.addEventListener("load", init, false);

function init() {
	// elements
	Els.editor = document.querySelector("#editor"); // main image canvas (this is exported at the end)
	Els.transparency = document.querySelector("#transparency"); // transparency canvas
	Els.saveCanvas = document.querySelector("#saveCanvas"); // image save canvas (always hidden)
	Els.savedImageWrapper = document.querySelector("#savedImageWrapper"); // art close button (hidden unless saved art is shown)
	Els.toolButtons = document.getElementsByName('tool'); // tool setting radio buttons
	Els.colorWell = document.querySelector("#colorWell"); // color well
	
	// canvas context
	Ctx.editor = Els.editor.getContext('2d');
	Ctx.transparency = Els.transparency.getContext('2d');
	
	// brush
	Tool = "brush";
	Brush.color = Els.colorWell.value; // default color
	Ctx.editor.fillStyle = Els.colorWell.value; // default color
	Brush.size = 16; // pixels
	
	// draw transparency background
	drawTransparency();
	
	// color well
	Els.colorWell.addEventListener("change", updateColor, false); // update the brush color upon color change
	Els.colorWell.select();
	
	// canvas event listeners (for painting)
	Els.editor.addEventListener("mousemove", paint); // paint tile if mouse is moved (checks if mouse is down)
	Els.editor.addEventListener("mousedown", mouseDown); // mouse set to down
	Els.editor.addEventListener("mouseup", mouseUp); // mouse set to up
	Els.editor.addEventListener("mouseout", mouseUp); // also set mouse to up when user leaves the canvas with mouse
}

//
// Global variable definition
//

var ImageData = {}; // tbd init this variable

var Brush = {};

var Els = {}; // elements

var Ctx = {};

var mouseIsDown = false; // set to false when mouse is up (on editor canvas) and true when it is down

var saving = false; // set to the save dimensions when the image is in the process of being saved

//
// Functions
//

// update brush color
function updateColor(event) {
	Brush.color = event.target.value;
	Ctx.editor.fillStyle = event.target.value; // update canvas fill color
}

// fill transparency grid background (grey and white)
// called on init and whenever brush size changes
function drawTransparency() {
	// clear canvas
	Ctx.transparency.clearRect(0, 0, Els.transparency.width, Els.transparency.height);
	
	// set color for drawing
	Ctx.transparency.fillStyle = "#eeeeee"; // tbd more specific color?
	
	// figure out number of columns and rows
	let columns = Els.transparency.width / Brush.size;
	let rows = Els.transparency.height / Brush.size;
	
	// for loops to draw squares in checkerboard pattern
	for (let col = 0; col < columns; col++) {
		for (let row = col % 2; row < rows; row += 2) {
			// +=2 to make every other square grey
			// starting position alternates between 0 and 1
			Ctx.transparency.fillRect(col * Brush.size + 1, row * Brush.size + 1, Brush.size, Brush.size);
			// +1 so border is not drawn on
		}
	}
}

// init art selection save
function saveArtSelection() {
	// check that nothing is being currently saved
	if (saving === false) {
		saving = {}; // ready for startPos and finishPos to be saved, in the format of an object with row and col parameters
	}
}

// called on mouse down
function mouseDown(event) {
	mouseIsDown = true; // set to down
	
	// update selected tool (since it can only be changed before mouseDown is called - not whilst mouse is down)
	for (var i = 0; i < Els.toolButtons.length; i++) {
		if (Els.toolButtons[i].checked) {
			Tool = Els.toolButtons[i].value;
			break;
		}
	}
	
	paint(event); // initial paint tile (for click)
}


// called on mouse up or leave
function mouseUp(event) {
	mouseIsDown = false; // set to up
	if (saving !== false && saving.startPos !== undefined) {
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

// paint a tile
// this function is called on mouse move, hence it needs to check if the mouse is up or down first
// TBD - possibly inefficient that this is called so often?
function paint(event) {
	// check if the mouse is down
	if (mouseIsDown) {
		// find cursor row and column
		let position = findTile(event);
		if (saving === false) {
			// only paint when the image is not being saved
			if (Tool === "brush") {
				// set the tile's color
				setTile(position);
			}
			else if (Tool === "eraser") {
				// erase the tile
				eraseTile(position);
			}
		}
		else if (saving.startPos === undefined) {
			// saving start position has not been saved yet
			saving.startPos = position;
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
	// update imagedata (for exporting/importing)
	//ImageData[position.col][position.row] = Brush.color;
	
	// draw change onto editor canvas
	Ctx.editor.fillRect(position.col * Brush.size, position.row * Brush.size, Brush.size, Brush.size);
}

// sets a tile and renders this change onto the editor canvas
function eraseTile(position) {
	// update imagedata (for exporting/importing)
	//ImageData[position.col][position.row] = "";
	
	// draw change onto editor canvas
	Ctx.editor.clearRect(position.col * Brush.size, position.row * Brush.size, Brush.size, Brush.size);
}

// clears the editor canvas
function clearCanvas() {
	Ctx.editor.clearRect(0, 0, Els.editor.width, Els.editor.height);
}

// user setting to clear the editor canvas
function clearAll() {
	if (confirm("Are you sure you want to clear the canvas?")) {
		clearCanvas();
	}
}

// set the dimensions of the canvases
// this clears any existing drawing on it
function setDimensions() {
	// check they are happy for their art to be cleared
	if (confirm("Are you sure you want to resize the canvas? This will clear any existing art on it.")) {
		// take inputs
		let width = parseInt(prompt("Please enter pixel width value for canvas (leave blank to remain the same)"));
		let height = parseInt(prompt("Please enter height width value for canvas (leave blank to remain the same)"));
		
		if (!isNaN(width) && width > 0) {
			// valid width value
			
			// round to brush size
			width = Math.ceil(width/Brush.size)*Brush.size;
			
			// resize canvases
			Els.editor.width = width;
			Els.transparency.width = width;
			// no need for saveCanvas to be resized - it is resized anyway whenever it is used to selection size
		}
		
		if (!isNaN(height) && width > 0) {
			// valid height value
			
			// round to brush size
			height = Math.ceil(height/Brush.size)*Brush.size;
			
			// resize canvases
			Els.editor.height = height;
			Els.transparency.height = height;
			// no need for saveCanvas to be resized - it is resized anyway whenever it is used to selection size
		}
		
		drawTransparency();
		
		Ctx.editor.fillStyle = Els.colorWell.value;
	}
}

var canvas = document.getElementById('canvas');
var context = canvas.getContext('2d');
var menu_directions = document.getElementById('directions');
var uploader = document.getElementById('upload');
var body = document.getElementById('body');
var walking = false, customGaniPersist = false;

var convertedImage = new Image;

var initialized = false;
var sprite = 0;

var gani = {};
gani.sprites = {};

var ox = (canvas.width - 48)/2,oy = (canvas.height - 48)/2,oz = 1;
var dragging = false,dragx = ox,dragy = oy;
var pinching = false,pinch = [[ox,oy],[ox,oy]];

var desiredFrameTick, lastTick, aniStepTime = 0;

var defaultAnimations = [
  "default.gani","walk.gani","idle.gani","carry.gani","sword.gani","sit.gani","mount.gani","pull.gani","dead.gani"
];

var cachedAnis = {};

var defaultImageSource = {
    "SPRITES" : "res/images/sprites.png",
    "HEAD"    : "res/images/head0.png",
    "BODY"    : "res/images/body.png",
    "ATTR1"   : "res/images/hat0.png",
    "ATTR2"   : "res/images/classiciphone_mount_panda.png",
    "ATTR4"   : "res/images/accessory_backpack0.png",
    "HORSE"   : "res/images/ride.png",
    "SHIELD"  : "res/images/shield1.png",
    "SWORD"   : "res/images/sword1.png",
    "PARAM1"  : "res/images/null.png"
};
var visibleAttributes = ["SPRITES","HEAD","BODY","ATTR1","ATTR2","ATTR4","HORSE","SHIELD","SWORD","PARAM1"];
var defaultImage = {};

function preloadImages() {
  for (let i of Object.keys(defaultImageSource)) {
    defaultImage[i] = new Image();
    defaultImage[i].src = defaultImageSource[i];
  }
}

// mouse input
canvas.addEventListener('mousedown', e => {
  dragging = true;
  dragx = e.offsetX;
  dragy = e.offsetY;
  if(canvas.setCapture) canvas.setCapture();
});

canvas.addEventListener('mousemove', e => {
  if (dragging === true) drag(e.offsetX, e.offsetY);
});

canvas.addEventListener('mouseup', e => {
  dragging = false;
  if (canvas.releaseCapture) canvas.releaseCapture();
});

canvas.addEventListener('wheel', e => {
  dragging = false;
  if (canvas.releaseCapture) canvas.releaseCapture();
  if (e.deltaY < 0) changeZoom(Math.min(4,oz+1));
  else changeZoom(Math.max(1,oz-1));
});

// mobile touch input
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  let touch = e.touches;

  dragx = touch[0].clientX;
  dragy = touch[0].clientY;
  dragging = true;
  pinching = false;
  
  if (canvas.setCapture) canvas.setCapture();
});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  let touch = e.touches[0];
  if (dragging === true) {
    drag(touch.clientX,touch.clientY);
  } 
});

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  dragging = false;
  pinching = false;
  if (canvas.releaseCapture) canvas.releaseCapture();
});

// mobile pinch
/* iOS only so let's not...
canvas.addEventListener('gestureend', e => {
  if (e.scale < 1.0) {
    // User moved fingers closer together
     changeZoom(Math.max(1,oz-1));
  } else if (e.scale > 1.0) {
    // User moved fingers further apart
    changeZoom(Math.min(4,oz+1));
  }
});
*/

document.addEventListener('keydown', e => {
  let dirKeys = [37,38,39,40];
  
  let keyMaps = [
    [38,"walk(0)"],
    [37,"walk(1)"],
    [40,"walk(2)"],
    [39,"walk(3)"],
    [83,"loadInternalGani('sword.gani')"],
    [65,"loadInternalGani('grab.gani')"],
  ];
  
  for (let i of keyMaps) {
    if (event.keyCode == i[0]) {
      e.preventDefault();
      eval(i[1]);
      if (dirKeys.includes(i[0])) {
        if (gani.file == "idle.gani") {
          loadInternalGani("walk.gani");
          walking = true;
        }
      }
      break;
    }
  }
});

function walk(dir) {
  if (gani.file == "pull.gani") return;
  
  if (gani.file == "grab.gani") {
    if (dir == (gani.dir+2)%4) loadInternalGani("pull.gani");
  } else changeDir(dir);
}

document.addEventListener('keyup', e => {
  let dirKeys = [37,38,39,40];
  if (dirKeys.includes(e.keyCode)) {
    if (gani.file == "walk.gani" && walking) {
      loadInternalGani("idle.gani");
    }
    walking = false;
  } else if (e.keyCode == 65 && (gani.file == "grab.gani" || gani.file == "pull.gani")) {
    loadInternalGani("idle.gani");
  }
});

function changeZoom(z) {
  //if (z != oz) context.scale(z/oz,z/oz);
  let oldz = oz;
  
  oz = z;
  
  dx = (canvas.width/z - canvas.width/oldz) / 2;
  dy = (canvas.height/z - canvas.height/oldz) / 2;
  
  ox = Math.max(0,Math.min(getCanvasWidth()-48,ox+dx));
  oy = Math.max(0,Math.min(getCanvasHeight()-48,oy+dy));
  
  document.getElementById('zoom').selectedIndex = z-1;
}

function drag(mx, my) {
  let dx = (mx - dragx)/oz;
  let dy = (my - dragy)/oz;
  ox = Math.max(0,Math.min(getCanvasWidth()-48,ox + dx));
  oy = Math.max(0,Math.min(getCanvasHeight()-48,oy + dy));
  
  dragx = mx;
  dragy = my;
}

function getCanvasWidth() {
  return canvas.width/oz;
}

function getCanvasHeight() {
  return canvas.width/oz;
}

// alternative to DOMContentLoaded
document.onreadystatechange = function () {
  if (document.readyState == "complete") {
    onLoadDefaultAnimationList();
    
    //console.log("Document finished loading. Proceed with animations.");
    preloadImages();
    startAnimating(20);
    incrementServerStat("visits");
  }
}

function onLoadDefaultAnimationList() {
  let menu_animations = document.getElementById("animations");
  menu_animations.options = [];
  
  for (let i of defaultAnimations) {
    let opt = document.createElement("option");
    opt.appendChild(document.createTextNode(i));
    opt.value = i; 
    menu_animations.appendChild(opt);
  }
}

function startAnimating(fps) {
  loadInternalGani(document.getElementById("animations").value);
  context.imageSmoothingEnabled = false;
  
  changeZoom(isMobileDevice() ? 2 : 1);

  ox = (getCanvasWidth() - 48)/2;
  oy = (getCanvasHeight() - 48)/2;
  
  desiredFrameTick = 1000/fps;
  
  lastTick = Date.now();
  gameLoop();
 
}

function gameLoop(timeStamp) {
  
  window.requestAnimationFrame(gameLoop);
  
  let currentTick = Date.now();
  let timeElapsed = currentTick - lastTick;

  if (timeElapsed > desiredFrameTick) {
    draw(ox, oy);
    lastTick = currentTick;
  }
  
}

function drawLine(fromx,fromy,destx,desty) {
  context.strokeStyle = "rgb(0, 160, 0)";
  context.lineWidth = 1;
  context.setLineDash([3, 3]);

  context.beginPath();
  context.moveTo(fromx,fromy);
  context.lineTo(destx,desty);
  context.stroke();
  context.setLineDash([]);
}

function draw(x,y) {
  let frame;
 
  context.scale(oz,oz);
  context.clearRect(0,0,getCanvasWidth(),getCanvasHeight());
  context.fillStyle = "rgb(0, 128, 0)";
  context.fillRect(0,0,getCanvasWidth(),getCanvasHeight());
  
  let lineOffset = 1;
  drawLine(0,y+lineOffset,getCanvasWidth(),y+lineOffset);
  drawLine(x+lineOffset,0,x+lineOffset,getCanvasHeight());
  drawLine(x+48-lineOffset,y+lineOffset,x+48-lineOffset,y+48+lineOffset);
  drawLine(x+lineOffset,y+48-lineOffset,x+48+lineOffset,y+48-lineOffset);
  
  // Convert these default ganis from default to idefault shield position
  let defaultConvertGanis = ["idle.gani","walk.gani","default.gani","walkslow.gani","profile_default.gani"];
  
  if (gani != null) {
    if (typeof gani.anistep == "undefined") return;
             
    if (gani.singledirection) changeDir(0);
    
    if (gani.frames[gani.anistep].framelength == null) gani.frames[gani.anistep].framelength = 0.05;
    let nextFrame = Math.max(0,gani.frames[gani.anistep].framelength - 0.05);
    aniStepTime += 0.05;

    if (aniStepTime > nextFrame) {
      if (gani.loop) gani.anistep = (gani.anistep+1)%gani.frames.length;
      else if (gani.anistep < gani.frames.length-1) {
        gani.anistep = Math.min(gani.frames.length-1,gani.anistep+1);
      } else if (gani.setbackto != null) loadInternalGani(gani.setbackto);
      aniStepTime = 0;
    }
    
    let sprites = gani.frames[gani.anistep][gani.dir].frames;
    
    var img = new Image();
    img.src = "res/images/sprites.png";
      
    for (var i=0;i<sprites.length;i++) {
      let drawsprite = sprites[i].sprite;
      let drawx = x + sprites[i].x;
      let drawy = y + sprites[i].y;
      
      let spriteObject = gani.sprites[drawsprite];
      

      var compareSpriteSource = spriteObject.source;
      
      // 2player mounts use ATTR2 but we should lump them under the same visibility
      if (compareSpriteSource === "ATTR2") compareSpriteSource = "HORSE";
      
      // If the sprite uses an ATTR that isn't assigned an image fall back on PARAM1 for compatibility/simplicity
      if (typeof defaultImage[compareSpriteSource] == "undefined") {
        if (compareSpriteSource.startsWith("ATTR")) compareSpriteSource = "PARAM1";
      }
      
      if (typeof defaultImage[compareSpriteSource] == "undefined") continue;
      
      // Don't render attributes that are toggled to be invisible
      // But only hide them if they are in the list of default visible attributes
      if (visibleAttributes.indexOf(compareSpriteSource) < 0 && defaultImage[compareSpriteSource].src != null) continue;
      
      if (compareSpriteSource === "SHIELD") {
      	sx = spriteObject.sx;
        sy = spriteObject.sy;
        sw = spriteObject.sw;
        sh = spriteObject.sh;
        tx = drawx;
        ty = drawy;
        
        imgw = defaultImage[compareSpriteSource].width;
        imgh = defaultImage[compareSpriteSource].height;
        
        if (imgw != 38) {
          sx = (sx * imgw) / 38;
          oldw = sw;
          sw = (sw * imgw) / 38;
          tx = tx - (sw - oldw)/2;
        }
        if (imgh != 20) {
          sy = (sy * imgh) / 20;
          oldh = sh;
          sh = (sh * imgh) / 20;
          ty = ty - (sh - oldh)/2;
        }
        
       if (defaultConvertGanis.indexOf(gani.file) >= 0 && gani.dir == 2 && spriteObject.index == 12) tx += 16;

        context.drawImage(defaultImage[compareSpriteSource],sx,sy,sw,sh,tx,ty,sw,sh);
      } else {
        context.drawImage(defaultImage[compareSpriteSource],spriteObject.sx,spriteObject.sy,spriteObject.sw,spriteObject.sh,drawx, drawy,spriteObject.sw,spriteObject.sh);
        
      }
    }
    
    context.scale(1/oz,1/oz);
    
    let debugs = [
      //"Window: " + window.innerWidth  + ", " + window.innerHeight,
      //gani.file + " : " + defaultConvertGanis.indexOf(gani.file),
      "Frame: " + (gani.anistep+1) + "/" + gani.frames.length
    ];
    if (gani.setbackto != null && gani.loop) debugs.push("Setbackto: " + gani.setbackto);
    for (var i=0;i<debugs.length;i++) {
      debugText(debugs[i],10, 20+i*20);
    }
  }

}

function debugText(text,x,y) {
    context.fillStyle = "rgb(0, 0, 0)";
    context.font = "bold 14px Lucida Sans Typewriter";
    context.fillText(text, x+1, y+1);
    
    context.fillStyle = "rgb(0, 220, 0)";
    context.fillText(text, x, y);
}

var body = document.getElementById('canvas');

body.addEventListener('dragover', (event) => {
  event.stopPropagation();
  event.preventDefault();
  // Style the drag-and-drop as a "copy file" operation.
  event.dataTransfer.dropEffect = 'copy';
});

body.addEventListener('drop', (event) => {
  event.stopPropagation();
  event.preventDefault();
  const fileList = event.dataTransfer.files;
  
  for (const file of fileList) {
    if (!file) continue;
    
    if (file.type.match(/image.*/)) {
      loadImageFile(file);
    } else if (file.name.endsWith(".gani")) loadExternalGani(file);
  }
});

uploader.onchange = () => {
  const file = uploader.files[0];
  //console.log("File uploaded: " + file.name);
  
  if (file.type.match(/image.*/)) {
    loadImageFile(file);
  } else if (file.name.endsWith(".gani")) loadExternalGani(file);
}

async function loadImageFile(file) {

  if (file.type == "image/gif") {
    const gifimg = gifler(file);
    console.log("Loading gif... " + gifimg.frames());
  }
    
  try {
    let contentBuffer = await readImageAsync(file);
    
    let img = new Image();
    let imgType = null;
    img.src = contentBuffer;

    const year = new Date(file.lastModified).getFullYear();
  
    img.onload = function() {
      imgType = getImageType(file.name,img);
      
      if (imgType == null) {
        alert("That is an unsupported custom!");
        return;
      }
       
      incrementServerStat("uploads_TOTAL");
      incrementServerStat("uploads_" + imgType);
            
      if (imgType === "HORSE") {
        if (img.height == 864) {
          loadInternalGani("bigmount.gani");
        } else {
          loadInternalGani("mount.gani");
        }
      } else if (imgType === "ATTR2" && img.height == 768) {
        loadInternalGani("2pmount.gani");
      } else if (imgType == "PARAM1" && customGaniPersist == false) {
        let tryParam = getParamGani(img);
        if (tryParam != null) loadInternalGani(tryParam);
      }
      
      defaultImage[imgType] = new Image();
      defaultImage[imgType].src = getGraalSafeImage(img,(year > 2012 && imgType != "BODY"));
    }
      
  } catch(err) {
    //console.log(err);
  }
}

function getGraalSafeImage(img,fixblackandwhite) {
  var c = document.createElement('canvas');
  var w = img.width, h = img.height;
  c.width = w;
  c.height = h;

  var ctx = c.getContext('2d');
  
  //onGetPNGPalette

  ctx.drawImage(img, 0, 0, w, h);
  
  if (fixblackandwhite) {
    var imageData = ctx.getImageData(0,0, w, h);
    var pixel = imageData.data;

    var r=0, g=1, b=2,a=3;
    for (var p = 0; p<pixel.length; p+=4) {
      if (pixel[p+r] == 255 && pixel[p+g] == 255 && pixel[p+b] == 255) {
        pixel[p+a] = 0;
      } else if (pixel[p+r] == 0 && pixel[p+g] == 0 && pixel[p+b] == 0) {
        pixel[p+a] = 0;
      }
    }

    ctx.putImageData(imageData,0,0);
  }

  return c.toDataURL('image/png');
}

/*
  In the future we will need to load binary PNG and look for PLTE data
  If found(not all PNGs are indexed) we will extract the palette and do a few things
   - Bodies use the first 5(technically 7) indices from the palette to recolor the body
     so we will store those images and when processing the image replace them with new colors
   - We will need to also scan the PNG binary for tRNS chunks which represent the transparent palette
     whichever colors match those values we will make transparent as this is what Graal does
     (and why some colors such as #000000 commonly become transparent as they are often used as transparent values
*/  
function onGetPNGPalette() {
  
}

function getImageType(filename,img) {
  //console.log(filename + " - " + "width: " + img.width + ", height : " + img.height);
  if (img.width == 32 && img.height == 560)       return "HEAD";
  else if (img.width == 192 && img.height == 144) return "ATTR1";
  else if (img.width == 240 && img.height == 144) return "ATTR4";
  else if (img.width == 128 && img.height == 720) return "BODY";
  else if (img.width == 128 && img.height == 96 ) return "SWORD";
  else if (img.width == 96  && img.height == 576) return "HORSE";  // Default Horse
  else if (img.width == 192 && img.height == 576) return "HORSE";  // Default Horse with Drawover
  else if (img.width == 320 && img.height == 864) return "HORSE";  // New Horse
  else if (img.width == 160 && img.height == 864) return "HORSE";  // New Horse with Drawover
  else if (img.width == 128 && img.height == 768) return "ATTR2";  // 2player Horse
  else if (filename.toLowerCase().includes("shield") || img.width/img.height == 1.9) return "SHIELD";
  else return "PARAM1";
}

function getParamGani(img) {
  let ganiLookup = [
    [16,64,"classic_new_juggle.gani"],
    [13,49,"classiciphone_juggle_templateold.gani"],
    [48,64,"classic_trijuggle.gani"],
    [74,25,"classiciphone_bouncyball_templateold.gani"],
    [90,30,"ci_newbouncyball.gani"],
    [384,32,"classic_drinkfood.gani"],
    [224,32,"classic_newdrink.gani"],
    [26,31,"classiciphone_hulanew.gani"],
    [68,37,"ci_oldpogo.gani"],
    [66,37,"ci_newpogo.gani"],
    [96,48,"ci_newbigpogo.gani"],
    [160,36,"bigcity_fanwave2.gani"],
    [192,112,"walk_banner.gani"],
    [144,66,"classiciphone_jumpropefixed_big.gani"],
    [113,41,"classiciphone_jumpropefixed_small.gani"],
    [128,320,"shop_bomb_preview.gani"],
    [96,64,"shop_bow_preview.gani"],
    [360,20,"classic_wingsold.gani"],
    [100,110,"classic_wings.gani"],
  ];
  for (let i of ganiLookup) {
    if (img.width == i[0] && img.height == i[1]) return i[2];
  }
  return defaultAnimations[0];
}

async function loadExternalGani(file) {
  customGaniPersist = true;
  
  defaultImage["PARAM1"] = new Image();
  defaultImage["PARAM1"].src = defaultImageSource["PARAM1"];
  
  try {
    let contentBuffer = await readFileAsync(file);
    
    if (!contentBuffer.trim().startsWith("GANI0001")) {
      alert(file.name + " is not a valid gani file!");
      return;
    }
    
    createGaniFromText(contentBuffer);
    gani.file = file.name;
    cachedAnis[file.name] = gani;
    updateGaniFileName(file.name);
  } catch(err) {
    console.log(err);
  }
}

function updateGaniFileName(file) {
  if (!file.endsWith(".gani")) file = file + ".gani";
  gani.file = file;
}

async function loadInternalGani(file) {
  customGaniPersist = false;
  if (!file.endsWith(".gani")) file = file + ".gani";
  
  try {
    let contentBuffer = "";
    
    let serverGani = await getServerGaniContent("res/ganis/" + file);

    if (typeof serverGani == "undefined") {
      contentBuffer = getInternalGani(file); 
    } else {
      if (serverGani.length > 0) {
        contentBuffer = serverGani;
      } else {
        contentBuffer = getInternalGani(file); 
      }
    }
    
    if (!contentBuffer.trim().startsWith("GANI0001")) {
      contentBuffer = getInternalGani(file); 
    }
    
    if (!contentBuffer.trim().startsWith("GANI0001")) {
      alert(file.name + " is not a valid gani file!");
      return;
    }
    
    createGaniFromText(contentBuffer);
    updateGaniFileName(file);
  } catch(err) {
    console.log(err);
  }
}

function readImageAsync(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  })
}

function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = reject;
    reader.readAsText(file);
  })
}

function createGaniFromText(text) {
  let oldDir = gani.dir;
  
  gani = {};
  gani.sprites = {};
  changeDir(oldDir == null ? 2 : oldDir);
  gani.anistep = 0;
  gani.setbackto = null;
  gani.loaded = true;
  
  gani.singledirection = false;
  gani.loop = false;
  
  /*
    gani.frame structure is -- gani.frames[framenumber]
                               gani.frames[framenumber][direction].frames // will return array of framesprite objects for a frame of the specified direction
                                                                          // For singleplayer direction will always be 0
                               gani.frames[framenumber].framelength       // will return the playback length in seconds of the specified frame
  */
  gani.frames = [];
  
  // Determine if the gani is single direction
  if (text.includes("SINGLEDIRECTION")) gani.singledirection = true;
  
  // Determine if the gani should loop
  if (text.includes("LOOP")) gani.loop = true;
  
  let frameSprites = [];
  let newFrame = [];
  
  var parsingAni = false;
  var lines = text.split("\n");
  for (var i=0;i<lines.length;i++) {
    var origline = lines[i];
    var line = lines[i].trim();
    
    // Skip empty lines
    if (line == "") continue;
    
    // Detect sprite definitions and create an object that is added to the gani.sprites array
    if (line.startsWith("SPRITE ")) {
      let addSprite = {};
      line = line.replace(/  +/g, " ");
      let tokens = line.split(" ");
      
      addSprite.index       = tokens[1];
      addSprite.source      = tokens[2];
      addSprite.sx          = tokens[3];
      addSprite.sy          = tokens[4];
      addSprite.sw          = tokens[5];
      addSprite.sh          = tokens[6];

      gani.sprites[addSprite.index] = addSprite;
      
      //console.log("New sprite added to gani object: " + addSprite.index + ", " + addSprite.source + 
      //            ", {" + addSprite.sx + ", " + addSprite.sy + ", " + addSprite.sw + ", " + addSprite.sw + "}");
                  
    // Detect when the gani format starts defining the animation and toggle a boolean
    // All lines are treated as animation code when the boolean is true
    } else if (line === "ANI" && !parsingAni) {
      parsingAni = true;
    // Stop parsing animation
    } else if (line === "ANIEND" && parsingAni) {
      parsingAni = false;
      
      if (gani.frames.length > 0) {
        let framedirections = gani.frames[gani.frames.length-1].length;
        if (framedirections > 0) {
          //console.log("New frame added to gani object: contains " + framedirections + " directions with a playback length of " + gani.frames[gani.frames.length-1].framelength);
        }
      }
      
    // All lines should be expected as animation code and should be treated as such
    } else if (line.startsWith("SETBACKTO")) {
      gani.setbackto = line.substring(9).trim();
      if (gani.setbackto === "iidle") gani.setbackto = "idle" + ".gani";
    } else if (parsingAni) {
      // Detect any frame delays and modify the framelength to add on the delay
      // WAIT represents a single frame of delay, and framerate is 20fps so waitvalue*0.05 will give us our additional frame length
      if (line.startsWith("WAIT")) {
        let delay = 0.05 + line.substring(5).trim()*0.05;
        delay = delay.toFixed(2);
        gani.frames[gani.frames.length-1].framelength = delay;
      } if (line.startsWith("PLAYSOUND")) {
        continue;
      } else {
        // All lines that contain sprite data should start with a space so let's check the untrimmed line
        if (!origline.startsWith(" ")) continue;
        
        if (gani.frames.length > 0) {
          let framedirections = gani.frames[gani.frames.length-1].length;
          if (framedirections > 0) {
            //console.log("New frame added to gani object: contains " + framedirections + " directions with a playback length of " + gani.frames[gani.frames.length-1].framelength);
          }
        }
        
        // If the gani is singledirection then each line of sprites represents a single frame of animation
        if (gani.singledirection) {
          let frameObj = createFrameFromLine(line);
          if (frameObj != null) {
            // For simplicity and consistency when gani is singledirection we are passing the new frames over as an array of 1 direction rather than 4 directions
            gani.frames.push([frameObj]);
            //console.log("New direction[" + (gani.frames.length-1) + "] added to frame[" + gani.frames.length + "]: contains " + frameObj.frames.length + " sprites.");
           }
        // Otherwise each line represents a direction of the animation, and every 4 lines is a single frame of animation
        // Typically these frames are divided by an empty line so ignore those
        } else {
          let frameObj = createFrameFromLine(line);
          if (frameObj != null) newFrame.push(frameObj);
          
          // Once we have loaded the sprites for each direction add it as a single frame
          // Clear newFrame to be propogated with the next set of frames for each direction
          if (newFrame.length >= 4) {
            for (let j=0;j<4;j++) {
              //console.log("New direction[" + j + "] added to frame[" + gani.frames.length + "]: contains " + newFrame[j].frames.length + " sprites.");
            }
            gani.frames.push(newFrame);
            gani.frames[gani.frames.length-1].framelength = 0.05;
            newFrame = [];
          }
        }
      }
    } 
  }
  
  //console.log("Gani object loaded successfully");
  //if (gani.singledirection) console.log(" > Single direction");
  //if (gani.loop) console.log(" > Loops");
  //console.log(" > Sprites loaded into gani object: " + Object.keys(gani.sprites).length);
  //console.log(" > Frames loaded into gani object: " + gani.frames.length);
  
  initialized = true;
}

function createFrameFromLine(text) {
  text = text.trim();
  if (text == "") return null;
  let frameSet = {};
  frameSet.frames = [];
  
  let newFrameSprite = {};
  let lines = text.split(",");
  for (let split of lines) {
    i = split.trim();
    i = i.replace(/  +/g, " ");
    
    let token = i.split(" ");
    newFrameSprite = {};
    newFrameSprite.sprite = token[0];
    newFrameSprite.x = parseInt(token[1]);
    newFrameSprite.y = parseInt(token[2]);
    //console.log("  > " + newFrameSprite.sprite + " : " + newFrameSprite.x + " : " + newFrameSprite.y);
    frameSet.frames.push(newFrameSprite);
  }
  
  return frameSet;
}

function changeDir(dir) {
  gani.dir = dir;
  document.getElementById('directions').selectedIndex = dir;
}

function onDirectionChanged(dropdown) {
  changeDir(dropdown.selectedIndex);
}

function onToggleVisibility(checkbox) {
  let index = visibleAttributes.indexOf(checkbox.value);
  if (checkbox.checked) {
    if (index < 0) visibleAttributes.push(checkbox.value);
  } else {
    if (index >= 0) visibleAttributes.splice(index, 1);
  }
}

function onAnimationChanged(dropdown) {
  loadInternalGani(dropdown.value);
}

function onZoomChange(dropdown) {
  let newzoom = Math.max(1,Math.min(4,dropdown.value));
  changeZoom(newzoom);
}

function isMobileDevice() {
  return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

function incrementServerStat(stat,val) {
  val = Math.max(1,val);
  let xhr = new XMLHttpRequest(); 
  let url = "stats.php"; 

  xhr.open("POST", url, true); 

  xhr.setRequestHeader("Content-Type", "application/json"); 

  xhr.onreadystatechange = function () { 
    if (xhr.readyState === 4 && xhr.status === 200) { 
    } 
  }; 

  var data = JSON.stringify({ "stat": stat}); 

  xhr.send(data); 
} 

async function getServerGaniContent(file) {
  if (!file.endsWith(".gani")) file = file + ".gani";
  
  try {
    const response = await fetch(file);
    const data = await response.text();
    return data;
  } catch (err) {
    //console.error(err);
  }
}
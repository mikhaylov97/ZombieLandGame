/**
 * Created by Arty on 20.11.2016.
 */
var mapManager = {
    mapData: null,
    tLayer: [],
    imgLoadCount: 0, // количество загруженных изображений
    imgLoaded: false, // изображения не загружены
    jsonLoaded: false, // json не загружен
    xCount: 0,
    yCount: 0,
    tSize: {x:50, y:50},
    mapSize: {x:50, y:50},
    tilesets: [],
    // видимая область с координатами левого верхнего угла
    view: {x: 0, y: 0, w: 1000, h:610},
    parseMap: function (tilesJSON) {
        this.mapData = JSON.parse(tilesJSON); //разобрать JSON
        this.xCount = this.mapData.width; // соэранение ширины
        this.yCount = this.mapData.height; // сохранение высоты
        this.tSize.x = this.mapData.tilewidth; // сохранение размера блока
        this.tSize.y = this.mapData.tileheight; // сохранение размера блока
        this.mapSize.x = this.xCount * this.tSize.x; // вычисление размера карты
        this.mapSize.y = this.yCount * this.tSize.y;
        for (var i = 0; i < this.mapData.tilesets.length; i++) {
            var img = new Image(); // создаем переменную для хранения изображений
            img.onload = function () { // при загрузке изображения
                mapManager.imgLoadCount++;
                if (mapManager.imgLoadCount === mapManager.mapData.tilesets.length) {
                    mapManager.imgLoaded = true; // загружены все изображения
                }
            };
            img.src = this.mapData.tilesets[i].image; // задание пути к изображению
            var t = this.mapData.tilesets[i]; //забираем tileset из карты
            var ts = { // создаем свой объект tileset
                firstgid: t.firstgid, // с него начинается нумерация в data
                image: img,
                name: t.name, // имя элемента рисунка
                xCount: Math.floor(t.imagewidth / mapManager.tSize.x), // горизонталь
                yCount: Math.floor(t.imageheight / mapManager.tSize.y) // вертикаль
            }; // конец объявления ts
            this.tilesets.push(ts); // сохраняем tileset в массив
        } // окончание цикла for
        this.jsonLoaded = true; // когда разобран весь json
    },
    // отображение карты
    draw: function(ctx) { // отрисовка карты в контексте
        // если карта не загружена, то повторить прорисовку через 100 мс
        if (!mapManager.imgLoaded || !mapManager.jsonLoaded) {
            setTimeout(function () {
                mapManager.draw(ctx);
            }, 100);
        } else {
            var layerCount = 0;
            if (this.tLayer.length == 0) {// проверка, что tLayer настроен
                for (var id = 0; id < this.mapData.layers.length; id++) {
                    // проходим по всем layer карты
                    var layer = this.mapData.layers[id];
                    if (layer.type === "tilelayer") {
                        this.tLayer.push(layer);
                        //break;
                    }
                }
            }
            for (var j = 0; j < this.tLayer.length; j++) {
                for (var i = 0; i < this.tLayer[j].data.length; i++) { // проходим по всей карте
                    if (this.tLayer[j].data[i] !== 0) { // если данных нет, то пропускаем
                        var tile = this.getTile(this.tLayer[j].data[i]); // получение блока по индексу
                        var pX = (i % this.xCount) * this.tSize.x; // вычисляем x в пикселях
                        var pY = Math.floor(i / this.xCount) * this.tSize.y;
                        // не рисуем за пределами видимой зоны
                        if (!this.isVisible(pX, pY, this.tSize.x, this.tSize.y))
                            continue;
                        // сдвигаем видимую зону
                        pX -= this.view.x;
                        pY -= this.view.y;
                        ctx.drawImage(tile.img, tile.px, tile.py, this.tSize.x, this.tSize.y, pX, pY, this.tSize.x, this.tSize.y); //
                        //отрисовка в контексте
                    }
                }
            }
        }
    },
    // ajax-загрузка карты
    loadMap: function(path) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if(request.readyState === 4 && request.status === 200) {
                mapManager.parseMap(request.responseText);
            }
        };
        request.open("GET", path, true);
        request.send();
    },
    getTile: function(tileIndex) { // индекс блока
        var tile = {
            img: null, // изображение tileset
            px: 0, py: 0 // координаты блока в tileset
        };
        var tileset = this.getTileset(tileIndex);
        tile.img = tileset.image; // изображение искомого tileset
        var id = tileIndex - tileset.firstgid; // индекс блока в tileset
        // блок прямоугольный, остаток от деления на xCount дает х в tileset
        var x = id % tileset.xCount;
        var y = Math.floor(id / tileset.xCount);
        tile.px = x * mapManager.tSize.x;
        tile.py = y * mapManager.tSize.y;
        return tile; // возвращаем тайл для отображения
    },
    getTileset: function(tileIndex) { // получение блока по индексу
        for (var i = mapManager.tilesets.length - 1; i >= 0; i--) {
            // в каждом tilesets[i].firstgid записано число, с которого начинается нумерация блоков
            if (mapManager.tilesets[i].firstgid <= tileIndex) {
                // если индекс первого блока меньше , либо равен искомому, значит этот tileset и нужен
                return mapManager.tilesets[i];
            }
        }
        return null;
    },
    isVisible: function(x, y, width, height) {
        // не рисуем за пределами видимой зоны
        return !(x + width < this.view.x || y + height < this.y || x > this.view.x + this.view.w || y > this.view.y + this.view.h);
    },
    getTilesetIdx: function (x, y) {
        // получить блок по координатам на карте
        var wX = x;
        var wY = y;
        var idx = Math.floor(wY / this.tSize.y) * this.xCount + Math.floor(wX / this.tSize.x);
        return this.tLayer[1].data[idx];
    },
    centerAt: function (x, y) {
        if (x < this.view.w / 2) // Центрирование по горизонтали
            this.view.x = 0;
        else if (x > this.mapSize.x - this.view.w / 2)
            this.view.x = this.mapSize.x - this.view.w;
        else
            this.view.x = x - (this.view.w / 2);
        if (y < this.view.h / 2) // центрирование по вертикали
            this.view.y = 0;
        else if (y > this.mapSize.y - this.view.h / 2)
            this.view.y = this.mapSize.y - this.view.h;
        else
            this.view.y = y - (this.view.h / 2);
    },
    parseEntities: function () { // разбор слоя типа objectgroup
        if (!mapManager.imgLoaded || !mapManager.jsonLoaded) {
            setTimeout(function () {
                mapManager.parseEntities();
            }, 100);
        } else {
            for (var j = 0; j < this.mapData.layers.length; j++) { // просмотр всех слоев
                if (this.mapData.layers[j].type === 'objectgroup') {
                    var entities = this.mapData.layers[j]; // слой с объектами следует разобрать
                    for (var i = 0; i < entities.objects.length; i++) {
                        var e = entities.objects[i];
                        try {
                            var obj = Object.create(gameManager.factory[e.type]);
                            if (e.type === 'Spawn') {
                                obj.name = e.name+gameManager.spawnNum++;
                                obj.pos_x = e.x;
                                obj.pos_y = e.y;
                                obj.size_x = e.width;
                                obj.size_y = e.height;
                                obj.count = gameManager.level * 5;
                                gameManager.entities.push(obj);
                                continue;
                            }
                            // в соответствии с типом создаем объект
                            obj.name = e.name;
                            obj.pos_x = e.x;
                            obj.pos_y = e.y;
                            obj.size_x = e.width;
                            obj.size_y = e.height;
                            // помещаем в массив объектов
                            gameManager.entities.push(obj);
                            if (obj.name === 'player') {
                                obj.pos_x += 8;
                                obj.pos_y += 5;
                                obj.size_x = 30;
                                obj.size_y = 35;
                                //инициализируем параметры игрока
                                obj.dirSprite = 'hero_left';
                                gameManager.initPlayer(obj);
                            }
                        } catch (ex) {
                            console.log("Error while creating: [" + e.gid + "]" + e.type + " " + ex);
                        }
                    }
                }
            }
        }
    }
};

/////////////////////////////
////// SPRITE MANAGER /////////
////////////////////////////////

var spriteManager = {
    image: new Image(), // рисунок с объектами
    sprites: [], // массив объектов для отображения
    imgLoaded: false, // изображения загружены
    jsonLoaded: false, // JSON загружен
    loadAtlas: function (atlasJson, atlasImg) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState === 4 && request.status === 200) {
                spriteManager.parseAtlas(request.responseText);
            }
        };
        request.open("GET", atlasJson, true);
        request.send();
        this.loadImg(atlasImg);
    },
    loadImg: function (imgName) { // загрузка изображения
        this.image.onload = function () {
            spriteManager.imgLoaded = true;
        };
        this.image.src = imgName;
    },
    parseAtlas: function (atlasJSON) { // разбор атласа с обеъектами
        var atlas = JSON.parse(atlasJSON);
        for (var name in atlas.frames) { // проход по всем именам в frames
            var frame = atlas.frames[name].frame; // получение спрайта и сохранение в frame
            this.sprites.push({name: name, x:frame.x, y: frame.y, w: frame.w, h: frame.h}); // сохранение характеристик frame в виде объекта
        }
        this.jsonLoaded = true; // атлас разобран
    },
    drawSprite: function (ctx, name, x, y, curFrame, size) {
        // если изображение не загружено, то повторить запрос через 100 мс
        if (!this.imgLoaded || !this.jsonLoaded) {
            setTimeout(function () {
                spriteManager.drawSprite(ctx, name, x, y, curFrame);
            }, 100);
        } else {
            var sprite = this.getSprite(name); // получить спрайт по имени
            if (!mapManager.isVisible(x, y, sprite.w, sprite.h))
                return; // не рисуем за пределами видимой зоны
            x -= mapManager.view.x;
            y -= mapManager.view.y;
            // отображаем спрайт на холсте
            // ctx.drawImage(this.image, sprite.x, sprite.y, sprite.w, sprite.h, x, y, sprite.w, sprite.h);
            if (name.match(/bullet/) || name.match(/box/)) {
                ctx.drawImage(this.image, sprite.x, sprite.y, sprite.w, sprite.h, x, y, sprite.w, sprite.h);
            } else {
                ctx.drawImage(this.image, size * curFrame, sprite.y, size, sprite.h, x, y, size, sprite.h);
            }

        }
    },
    getSprite: function (name) { // получить спрайт по имени
        for (var i = 0; i < this.sprites.length; i++) {
            var s = this.sprites[i];
            if (s.name === name)
                return s;
        }
        return null; // не нашли спрайт
    }
};


///////////////////////////////////////////////
////////////ENTITIES//////////////////////////
/////////////////////////////////////////////

var Entity = {
    pos_x: 0, pos_y: 0, // позиция объекта
    size_x: 0, size_y: 0, // размеры объекта
    extend: function (extendProto) { // расширение сущности
        var object = Object.create(this); // создание нового объекта
        for (var property in extendProto) { // для всех свойств нового объекта
            if (this.hasOwnProperty(property) || typeof object[property] === 'undefined') {
                // если свойства отсутствуют в родительском объекте, то добавляем
                object[property] = extendProto[property];
            }
        }
        return object;
    }
};

var Player = Entity.extend({
    lifetime: 100,
    currentFrame: 0,
    direction: 1,
    dirSprite: null,
    lastFrame: 0,
    shooting: false,
    gun: 'pistol',
    frameReload: 0,
    ammunition: 20,
    move_x: 0, move_y: 0, // направление движения
    speed: 15, // скорость объекта
    draw: function (ctx) { // прорисовка объекта
        // spriteManager.drawSprite(ctx,this.dirSprite, this.pos_x, this.pos_y);
        spriteManager.drawSprite(ctx,this.dirSprite, this.pos_x, this.pos_y, this.currentFrame, 50);
        if (this.frameReload >= 2) {
            this.currentFrame++;
            this.frameReload = 0;
        }
        if (this.currentFrame > 3) this.currentFrame = 0;
    },
    update: function () { // обновление в цикле
        this.frameReload++;
        var result = physicManager.update(this);
        if (result === 'stop') {this.currentFrame = 0;}
        if (result === 'stop' && this.shooting) {this.currentFrame = 5; this.shooting = false;}
        if (result === 'move_left') {this.direction = 0; this.dirSprite = 'hero_left';}
        if (result === 'move_right') {this.direction = 1; this.dirSprite = 'hero_right';}
        if (result === 'move_up') {this.direction = 3; this.dirSprite = 'hero_back';}
        if (result === 'move_down') {this.direction = 2; this.dirSprite = 'hero_front';}
    },
    onTouchEntity: function (obj) { // обработка столкновения с препятствием
        if (obj.name.match(/box/)) {
            soundManager.play("music/reload.mp3", {looping:false, volume: 1});
            var resolution = Math.random();
            if (resolution >= 0.27 && resolution <= 74) {
                this.ammunition += 15;
                document.getElementById("ammunition").innerHTML = 'Ammunition: ' + this.ammunition;
            } else {
                if (this.lifetime < 100) {
                    this.lifetime += 50;
                    if (this.lifetime > 100)
                        this.lifetime = 100;
                    document.getElementById("hp").innerHTML = 'HP: ' + this.lifetime;
                }
            }
            obj.kill();
        }
    },
    kill: function () { // уничтожение объекта
        gameManager.player = null;
        //window.location = 'menu.html';
        gameManager.kill(this);
        document.getElementById("ammunition").style.display = 'none';
        document.getElementById("hp").style.display = 'none';
        document.getElementById("gun").style.display = 'none';
        document.getElementById("level").style.display = 'none';
        document.getElementById("canvas").style.display = 'none';
        document.getElementById("menu").style.display = 'block';
        document.getElementById("lose").style.display = 'block';
        document.getElementById('pistol').style.display = 'none';
        document.getElementById('uzi').style.display = 'none';
        document.getElementById('shotgun').style.display = 'none';
        document.getElementById('opened').style.display = 'none';
        document.getElementById("score").style.top = '160px';
        document.getElementById("score").style.left = '620px';
    },
    fire: function () { // выстрел
        var shotgun = false;
        if ((gameManager.time >= 5 && this.gun.match(/Pistol/)) ||
            (gameManager.time >= 2 && this.gun.match(/Uzi/)) || (gameManager.time >= 5 && this.gun.match(/Shotgun/))) {
            gameManager.time = 0;
        } else return;
        if (this.ammunition > 0 || (this.ammunition === 0 && this.gun.match(/Pistol/))) {
            var bullet = Object.create(Bullet);
            if (this.gun.match(/Pistol/)) {
                soundManager.play('music/colt_shoot.mp3', {looping: false, volume: 1});
                bullet.speed = 50;
                bullet.name = "bullet_pistol" + (++gameManager.fireNum);
                bullet.size_x = 17; bullet.size_y = 17;
                bullet.move_x = this.move_x;
                bullet.move_y = this.move_y;
            }
            else if (this.gun.match(/Uzi/)) {
                this.ammunition--;
                soundManager.play('music/uzi_shoot.mp3', {looping: false, volume: 1});
                bullet.speed = 80;
                bullet.name = "bullet_uzi" + (++gameManager.fireNum);
                bullet.size_x = 17; bullet.size_y = 17;
                bullet.move_x = this.move_x;
                bullet.move_y = this.move_y;
                if (bullet.move_x !== 0 && bullet.move_y !== 0) {
                    bullet.move_x = 0;
                }
            } else {
                this.ammunition--;
                shotgun = true;
                var bullet2 = Object.create(Bullet);
                var bullet3 = Object.create(Bullet);
                soundManager.play('music/shotgun_shoot.mp3', {looping: false, volume: 1});
                bullet.speed = 50;
                bullet2.speed = 50;
                bullet3.speed = 50;
                bullet.name = "bullet_shotgun" + (++gameManager.fireNum);
                bullet2.name = "bullet_shotgun" + (++gameManager.fireNum);
                bullet3.name = "bullet_shotgun" + (++gameManager.fireNum);
                bullet.size_x = 10; bullet.size_y = 10;
                bullet2.size_x = 10; bullet2.size_y = 10;
                bullet3.size_x = 10; bullet3.size_y = 10;
                bullet.move_x = this.move_x;
                bullet.move_y = this.move_y;
                bullet2.move_x = this.move_x;
                bullet2.move_y = this.move_y;
                bullet3.move_x = this.move_x;
                bullet3.move_y = this.move_y;
                switch (this.direction) {
                    case 0: // выстрел влево
                        bullet.pos_x = this.pos_x + 15;
                        bullet.pos_y = this.pos_y + 3;
                        bullet.move_x = -1;
                        bullet2.pos_x = this.pos_x + 15;
                        bullet2.pos_y = this.pos_y - 5;
                        bullet2.move_x = -1;
                        bullet2.move_y = -0.1;
                        bullet3.pos_x = this.pos_x + 15;
                        bullet3.pos_y = this.pos_y + 11;
                        bullet3.move_x = -1;
                        bullet3.move_y = 0.1;
                        break;
                    case 1: // выстре вправо
                        bullet.pos_x = this.pos_x + this.size_x - 25;
                        bullet.pos_y = this.pos_y + 15;
                        bullet.move_x = 1;
                        bullet2.pos_x = this.pos_x + this.size_x - 25;
                        bullet2.pos_y = this.pos_y + 23;
                        bullet2.move_x = 1;
                        bullet2.move_y = 0.1;
                        bullet3.pos_x = this.pos_x + this.size_x - 25;
                        bullet3.pos_y = this.pos_y + 7;
                        bullet3.move_x = 1;
                        bullet3.move_y = -0.1;
                        break;
                    case 3: // выстрел вверх
                        bullet.pos_x = this.pos_x + 25;
                        bullet.pos_y = this.pos_y + 15;
                        bullet.move_y = -1;
                        bullet2.pos_x = this.pos_x + 10;
                        bullet2.pos_y = this.pos_y + 15;
                        bullet2.move_y = -1;
                        bullet2.move_x = -0.1;
                        bullet3.pos_x = this.pos_x + 40;
                        bullet3.pos_y = this.pos_y + 15;
                        bullet3.move_y = -1;
                        bullet3.move_x = 0.1;
                        break;
                    case 2: // выстрел вниз
                        bullet.pos_x = this.pos_x + 6;
                        bullet.pos_y = this.pos_y + 8;
                        bullet.move_y = 1;
                        bullet2.pos_x = this.pos_x - 4;
                        bullet2.pos_y = this.pos_y + 8;
                        bullet2.move_y = 1;
                        bullet2.move_x = -0.1;
                        bullet3.pos_x = this.pos_x + 16;
                        bullet3.pos_y = this.pos_y + 8;
                        bullet3.move_y = 1;
                        bullet3.move_x = +0.1;
                        break;
                }
                gameManager.entities.push(bullet2);
                gameManager.entities.push(bullet3);
            }
            document.getElementById("ammunition").innerHTML = 'Ammunition: ' + this.ammunition;
            this.shooting = true;
            switch (this.currentFrame) {
                case 0:
                    //this.currentFrame = 5;
                    this.currentFrame = 4;
                    break;
                case 1:
                    //this.currentFrame = 4;
                    this.currentFrame = 5;
                    break;
                case 2:
                    //this.currentFrame = 5;
                    this.currentFrame = 6;
                    break;
                case 3:
                    //this.currentFrame = 6;
                    this.currentFrame = 5;
                    break;
            }
            if (!shotgun)
                switch (this.direction) {
                    case 0: // выстрел влево
                        bullet.pos_x = this.pos_x + 3; //15
                        bullet.pos_y = this.pos_y + 3;
                        bullet.move_x = -1;
                        break;
                    case 1: // выстре вправо
                        bullet.pos_x = this.pos_x + this.size_x - 25;
                        bullet.pos_y = this.pos_y + 15;
                        bullet.move_x = 1;
                        break;
                    case 3: // выстрел вверх
                        bullet.pos_x = this.pos_x + 27;
                        bullet.pos_y = this.pos_y + 10;//20
                        bullet.move_y = -1;
                        break;
                    case 2: // выстрел вниз
                        bullet.pos_x = this.pos_x;
                        bullet.pos_y = this.pos_y + 9; //3
                        bullet.move_y = 1;
                        break;
                }
            this.pos_x += 7*this.move_x;
            this.pos_y += 7*this.move_y;
            gameManager.entities.push(bullet);
        } else {
            soundManager.play('music/no_ammo.mp3', {looping: false, volume: 1});
        }
    }
});

var Spawn = Entity.extend({
    count: 0,
    update: function () {
        var obj = Object.create(Zombie);
        obj.pos_x = this.pos_x;
        obj.pos_y = this.pos_y;
        obj.size_x = 35;
        obj.size_y = 40;
        var e = physicManager.entityAtXY(obj,this.pos_x, this.pos_y);
        // obj.pos_x += 11;
        // obj.pos_y += 2;
        // obj.size_x = 26;
        // obj.size_y = 44;
        if (this.count > 0 && e === null) {
            this.count--;
            obj.name = 'zombie'+(++gameManager.zombieNum);
            gameManager.zombieMaxNum++;
            gameManager.entities.push(obj);
        }
        if (this.count === 0 && gameManager.zombieNum === 0 && gameManager.zombieMaxNum === 0) {
            this.count = gameManager.level * 5;
        }
    }
});

var Bullet = Entity.extend({
    move_x: 0, move_y: 0,
    speed: 50,
    draw: function (ctx) {
        if (gameManager.player.gun.match(/Pistol/)) {
            if (this.move_x === 1) {
                spriteManager.drawSprite(ctx, "bullet_right", this.pos_x, this.pos_y, 1, 20);
            }
            if (this.move_x === -1) {
                spriteManager.drawSprite(ctx, "bullet_left", this.pos_x, this.pos_y, 1, 20);
            }
            if (this.move_y === 1) {
                spriteManager.drawSprite(ctx, "bullet_front", this.pos_x, this.pos_y, 1, 20);
            }
            if (this.move_y === -1) {
                spriteManager.drawSprite(ctx, "bullet_back", this.pos_x, this.pos_y, 1, 20);
            }
        } else if (gameManager.player.gun.match(/Uzi/)) {
            if (this.move_x === 1) {
                spriteManager.drawSprite(ctx, "uzi_bullet_right", this.pos_x, this.pos_y, 1, 10);
            }
            if (this.move_x === -1) {
                spriteManager.drawSprite(ctx, "uzi_bullet_left", this.pos_x, this.pos_y, 1, 10);
            }
            if (this.move_y === 1) {
                spriteManager.drawSprite(ctx, "uzi_bullet_front", this.pos_x, this.pos_y, 1, 10);
            }
            if (this.move_y === -1) {
                spriteManager.drawSprite(ctx, "uzi_bullet_back", this.pos_x, this.pos_y, 1, 10);
            }
        } else {
            spriteManager.drawSprite(ctx, "shotgun_bullet", this.pos_x, this.pos_y, 1, 10);
        }
    },
    update: function () {
        physicManager.update(this);
    },
    onTouchEntity: function (obj) {
        if (obj.name.match(/zombie/)) {
            if (this.name.match(/bullet_pistol/)) {
                obj.lifetime -= 40;
            }
            if (this.name.match(/bullet_uzi/)) {
                obj.lifetime -= 60;
            }
            if (this.name.match(/bullet_shotgun/)) {
                obj.lifetime -= 60;
            }
            if (obj.lifetime <= 0) {
                obj.currentFrame = 4;
            }
            //obj.kill();
        }
        this.kill();
    },
    onTouchMap: function (idx) {
        this.kill();
    },
    kill: function () {
        //gameManager.zombieNum--;
        gameManager.kill(this);
    }
});

var Zombie = Entity.extend({
    lifetime: 100,
    move_x: 0, move_y: 0, // направление движения
    speed: 6, // скорость объекта
    currentFrame: 0,
    size_x: 50, size_y: 50,
    direction: 1,
    attackReload: 0,
    frameReload: 0,
    pathReload: 0,

    dirSprite: 'zombie_front',
    draw: function (ctx) {
        if (this.currentFrame < 4) {
            spriteManager.drawSprite(ctx, this.dirSprite, this.pos_x, this.pos_y, this.currentFrame, 50);
            if (this.frameReload >= 4) {
                this.currentFrame++;
                this.frameReload = 0;
            }
            if (this.currentFrame > 3) this.currentFrame = 0;
        } else {
            spriteManager.drawSprite(ctx, this.dirSprite, this.pos_x, this.pos_y, this.currentFrame, 50);
            if (this.currentFrame === 6) this.currentFrame = 0;
            else this.currentFrame++;
        }
    },
    update: function () {
        if (this.lifetime >= 0) {
            this.attackReload++;
            this.pathReload++;
            this.frameReload++;
            if (this.pathReload >= 15) {
                this.move_x = 0;
                this.move_y = 0;
                var resolution = Math.random();
                if (this.pos_y >= gameManager.player.pos_y && this.pos_x <= gameManager.player.pos_x) {
                    if (resolution >= 0 && resolution <= 0.5) this.move_y = -1;
                    if (resolution > 0.5) this.move_x = 1;
                }
                else if (this.pos_y <= gameManager.player.pos_y && this.pos_x <= gameManager.player.pos_x) {
                    if (resolution >= 0 && resolution <= 0.5) this.move_y = 1;
                    if (resolution > 0.5) this.move_x = 1;
                }
                else if (this.pos_x >= gameManager.player.pos_x && this.pos_y <= gameManager.player.pos_y) {
                    if (resolution >= 0 && resolution <= 0.5) this.move_y = 1;
                    if (resolution > 0.5) this.move_x = -1;
                }
                else if (this.pos_x >= gameManager.player.pos_x && this.pos_y >= gameManager.player.pos_y) {
                    if (resolution >= 0 && resolution <= 0.5) this.move_y = -1;
                    if (resolution > 0.5) this.move_x = -1;
                }
                this.pathReload = 0;
            }
            var result = physicManager.update(this);
            if (result === 'stop') {
                this.currentFrame = 0;
            }
            if (result === 'move_left') {
                this.direction = 0;
                this.dirSprite = 'zombie_left';
            }
            if (result === 'move_right') {
                this.direction = 1;
                this.dirSprite = 'zombie_right';
            }
            if (result === 'move_up') {
                this.direction = 3;
                this.dirSprite = 'zombie_back';
            }
            if (result === 'move_down') {
                this.direction = 2;
                this.dirSprite = 'zombie_front';
            }
        } else {
            this.move_x = 0; this.move_y = 0;
            if (this.currentFrame == 6)
                this.kill();
        }
    },
    onTouchEntity: function (obj) {
        if (obj.name.match(/player/)) {
            if (this.attackReload >= 10) {
                soundManager.play('music/attack.mp3', {looping: false, volume: 3});
                this.attackReload = 0;
                this.currentFrame = 6;
                obj.lifetime -= 20;
                document.getElementById("hp").innerHTML = 'HP: ' + obj.lifetime;
                if (obj.lifetime <= 0)
                    obj.kill();
            }
        }
    },
    onTouchMap: function (idx) {

    },
    kill: function () {
        gameManager.score++;
        document.getElementById("score").innerHTML = 'Score: ' + gameManager.score;
        var obj = Object.create(Blood);
        obj.size_x = 80; obj.size_y = 80;
        obj.name = "blood" + (++gameManager.bloodNum); // счетчик выстрелов
        obj.move_x = 0;
        obj.move_y = 0;
        obj.pos_x = this.pos_x-7; obj.pos_y = this.pos_y+4;
        gameManager.zombieNum--;
        gameManager.onlytodraw.push(obj);
        gameManager.kill(this);
        //gameManager.zombieNum--;
    },
    attack: function () {

    }
});

var Box = Entity.extend({
    move_x:0, move_y: 0,
    size_x: 30, size_y: 30,
    draw: function (ctx) {
        spriteManager.drawSprite(ctx,"box", this.pos_x, this.pos_y,0, 30);
    },
    kill: function () {
        gameManager.kill(this);
    },
    update: function () {
        //physicManager.update(this);
    }
});

var Blood = Entity.extend({
    move_x: 0, move_y:0,
    size_x: 80, size_y: 80,
    update: function () {

    },
    draw: function () {
        spriteManager.drawSprite(ctx,"blood", this.pos_x, this.pos_y, 0, 80);
    },
    kill: function () {
        gameManager.kill(this);
    }
});

/////////////////////////////////////////////////
///////////EVENT MANAGER/////////////////////////
////////////////////////////////////////////////

var eventsManager = {
    bind: [], // сопоставление клавиш действиям
    action: [], // действия
    setup: function () { // настройка сопоставления
        this.bind[87] = 'up'; // w - двигаться вверх
        this.bind[65] = 'left'; // a - двигаться влево
        this.bind[83] = 'down'; // s - двигаться вниз
        this.bind[68] = 'right'; // d - двигаться вправо
        this.bind[32] = 'fire'; // пробел - выстрелить
        this.bind[49] = 'pistol';
        this.bind[50] = 'uzi';
        this.bind[51] = 'shotgun';
        this.bind[99] = 'killAll';
        // контроль событий клавиатуры
        document.body.addEventListener("keydown", this.onKeyDown);
        document.body.addEventListener("keyup", this.onKeyUp);
    },
    onKeyDown: function (event) {
        var action = eventsManager.bind[event.keyCode];
        if (eventsManager.action['left'] !== true && eventsManager.action['right'] !== true
            && eventsManager.action['up'] !== true && eventsManager.action['down'] !== true) {
            if (action) // проверка на action === true
                eventsManager.action[action] = true; // выполняем действие
        } else {
            // if (action === 'fire') {
            //     eventsManager.action[action] = true;
            // }
        }
        if (action === 'fire') {
            eventsManager.action[action] = true;
        }
        if (eventsManager.action['left'] === true || eventsManager.action['right'] === true
            || eventsManager.action['up'] === true || eventsManager.action['down'] === true) {
            if (gameManager.lastKeys.length === 0) {
                if (eventsManager.action['left'] === true && action !== 'left') {
                    var right = true;
                    for (var i = 0; i < gameManager.lastKeys.length; i++) {
                        if (gameManager.lastKeys[i] === 'left'){
                            right = false;
                            break;
                        }
                    }
                    if (right)
                        gameManager.lastKeys.push('left');
                }
                if (eventsManager.action['right'] === true && action !== 'right') {
                    var right = true;
                    for (var i = 0; i < gameManager.lastKeys.length; i++) {
                        if (gameManager.lastKeys[i] === 'right'){
                            right = false;
                            break;
                        }
                    }
                    if (right)
                    gameManager.lastKeys.push('right');
                }
                if (eventsManager.action['up'] === true && action !== 'up') {
                    var right = true;
                    for (var i = 0; i < gameManager.lastKeys.length; i++) {
                        if (gameManager.lastKeys[i] === 'up'){
                            right = false;
                            break;
                        }
                    }
                    if (right)
                    gameManager.lastKeys.push('up');
                }
                if (eventsManager.action['down'] === true && action !== 'down') {
                    var right = true;
                    for (var i = 0; i < gameManager.lastKeys.length; i++) {
                        if (gameManager.lastKeys[i] === 'down'){
                            right = false;
                            break;
                        }
                    }
                    if (right)
                    gameManager.lastKeys.push('down');
                }
            }
            eventsManager.action['left'] = false;
            eventsManager.action['right'] = false;
            eventsManager.action['up'] = false;
            eventsManager.action['down'] = false;
        }
        if (action) {// проверка на action === true
            eventsManager.action[action] = true; // выполняем действие
            var right = true;
            for (var i = 0; i < gameManager.lastKeys.length; i++) {
                if (gameManager.lastKeys[i] === action){
                    right = false;
                    break;
                }
            }
            if (right)
            gameManager.lastKeys.push(action);
        }
    },
    onKeyUp: function (event) {
        var action = eventsManager.bind[event.keyCode];
        if (action)
            eventsManager.action[action] = false; // отменили действие
        if (action === 'left' || action === 'right' || action === 'up' || action === 'down' ) {
            for (var i = gameManager.lastKeys.length - 1; i >= 0; i--) {
                if (action === gameManager.lastKeys[i]) gameManager.lastKeys.splice(i, 1);
            }
        }
    }
};

////////////////////////////////////////////////////
////////////////PHYSIC MANAGER///////////////////////
/////////////////////////////////////////////////////

var physicManager = {
    update: function (obj) {
        if (obj.move_x === 0 && obj.move_y === 0)
            return "stop"; // скорости движения нулевые
        if (obj.name.match(/bullet/) && !obj.name.match(/bullet_shotgun/)){
            if (obj.move_y !== 0 && obj.move_x !== 0)
                obj.move_y = 0;
        }
        var newX = obj.pos_x + Math.floor(obj.move_x * obj.speed);
        var newY = obj.pos_y + Math.floor(obj.move_y * obj.speed);

        // анализ пространства на карте по направлению движения
        var ts = mapManager.getTilesetIdx(newX + obj.size_x / 2, newY + obj.size_y / 2);
        var e = this.entityAtXY(obj, newX, newY); // объект на пути
        if (e !== null && obj.onTouchEntity) // если есть конфликт
            obj.onTouchEntity(e); // разбор конфликта внутри объекта
        if (ts !== 0 && obj.onTouchMap) // есть препятствие
            obj.onTouchMap(ts); // разбор конфликта с препятствием внутри объекта

        if (ts === 0 && e === null) { // перемещаем объект на свободное место
            obj.pos_x = newX;
            obj.pos_y = newY;
        } else
            return "break"; // дальше двигаться нельзя

        switch (obj.move_x + 2* obj.move_y) {
            case -1: // двигаемся влево
                return "move_left";
                break;
            case 1: // двигаемся вправо
                return "move_right";
                break;
            case -2: // двигаемся вверх
                return "move_up";
                break;
            case 2: // двигаемся вниз
                return "move_down";
                break;
        }
    },
    entityAtXY: function (obj, x, y) { // поиск объекта по координатам
        for (var i = 0; i < gameManager.entities.length; i++) {
            var e = gameManager.entities[i]; // рассматриваем все объекты на карте
            if (e.name !== obj.name && !e.name.match(/spawn/)) { // имя не совпадает
                if (x + obj.size_x < e.pos_x || // не пересекаются
                    y + obj.size_y < e.pos_y ||
                    x > e.pos_x + e.size_x ||
                    y > e.pos_y + e.size_y)
                    continue;
                return e; // найден объект
            }
        }
        return null; // объект не найден
    }
};


//////////////////////////////////////////////////
///////////////GAME MANAGER//////////////////////
//////////////////////////////////////////////////

var gameManager = { // менеджер игры
    factory: {}, // фабрика объектов на карте
    entities: [], // объекты на карте
    onlytodraw: [],
    fireNum: 0, // идентификатор выстрела
    spawnNum: 0,
    zombieNum: 0,
    lastKeys: [],
    zombieMaxNum: 0,
    score: 0,
    time: 5,
    boxLoop: 0,
    level: 1,
    bloodNum: 0,
    boxNum: 0,
    newLevel: false,
    player: null, // указатель на объект игрока
    laterKill: [], // отложенное уничтожение объектов
    initPlayer: function (obj) { // инициализация игрока
        this.player = obj;
        this.player.gun = 'Pistol';
    },
    kill: function (obj) {
        this.laterKill.push(obj);
    },
    createBox: function () {
        var obj = Object.create(Box);
        obj.name = 'box' + (++this.boxNum);
        do {
            var x = Math.random() * 1400;
            var y = Math.random() * 1200;
            var e = physicManager.entityAtXY(obj, x, y);
        }
        while (e != null);


        obj.pos_y = y + 5;
        obj.pos_x = x + 5;
        obj.size_x = 25;
        obj.size_y = 25;
        this.entities.push(obj);
    },
    update: function () { // обновление информации
        if (this.player === null)
            return;
        if (this.boxLoop >= (100 + this.level*35)) {
            this.createBox();
            this.boxLoop = 0;
        }
        this.boxLoop++;
        this.player.move_x = 0;
        this.player.move_y = 0;
        // if (eventsManager.action["up"]) this.player.move_y = -1;
        // if (eventsManager.action["down"]) this.player.move_y = 1;
        // if (eventsManager.action["left"]) this.player.move_x = -1;
        // if (eventsManager.action["right"]) this.player.move_x = 1;
        if (this.lastKeys[this.lastKeys.length-1] === "up") this.player.move_y = -1;
        if (this.lastKeys[this.lastKeys.length-1] === "down") this.player.move_y = 1;
        if (this.lastKeys[this.lastKeys.length-1] === "left") this.player.move_x = -1;
        if (this.lastKeys[this.lastKeys.length-1] === "right") this.player.move_x = 1;

        if (eventsManager.action["fire"]) this.player.fire();
        if (eventsManager.action["pistol"]) {
            gameManager.player.gun = 'Pistol';
            document.getElementById("gun").innerHTML = 'Gun: ' + gameManager.player.gun;
            eventsManager.action["pistol"] = false;
            soundManager.play('music/took_gun.mp3',{looping: false, volume: 1});
        }
        if (eventsManager.action["uzi"]) {
            if (this.level >= 3) {
                gameManager.player.gun = 'Uzi';
                document.getElementById("gun").innerHTML = 'Gun: ' + gameManager.player.gun;
                eventsManager.action["uzi"] = false;
                soundManager.play('music/took_gun.mp3', {looping: false, volume: 1});
            } else {
                soundManager.play('music/cant_use.mp3', {looping: false, volume: 1});
            }
        }
        if (eventsManager.action["shotgun"]) {
            if (this.level >= 4) {
                gameManager.player.gun = 'Shotgun';
                document.getElementById("gun").innerHTML = 'Gun: ' + gameManager.player.gun;
                eventsManager.action["shotgun"] = false;
                soundManager.play('music/took_gun.mp3', {looping: false, volume: 1});
            } else {
                soundManager.play('music/cant_use.mp3', {looping: false, volume: 1});
            }
        }

        if (eventsManager.action["killAll"]) {
            for (var i = 0; i < gameManager.entities.length; i++) {
                if (gameManager.entities[i].name.match(/zombie/)) {
                    gameManager.entities[i].kill();
                }
            }
        }

        //обновление информации по всем объектам на карте
        this.entities.forEach(function (e) {
            try {
                e.update();
            } catch(ex) {}
        });
        this.time++;
        // for (var entity in this.entities) {
        //     entity.update();
        // }

        // удаление всех объектов попавших в laterKill
        for(var i = 0; i < this.laterKill.length; i++) {
            var idx = this.entities.indexOf(this.laterKill[i]);
            if(idx > -1)
                this.entities.splice(idx, 1); // удаление из массива 1 объекта
        }
        if (this.laterKill.length > 0) // очистка массива laterKill
            this.laterKill.length = 0;
        mapManager.draw(ctx);
        mapManager.centerAt(this.player.pos_x, this.player.pos_y);
        this.draw(ctx);
        // if (this.zombieNum !== 0)
        //     this.newLevel = false;
        if (this.zombieNum === 0 && this.zombieMaxNum === this.level*10) {
            //this.zombieNum = 1;
            this.zombieMaxNum = 0;
            this.level++;
            this.player.ammunition += 15;
            if (this.level >= 3) {
                document.getElementById('uzi').style.display = 'block';
                if (this.level === 3) {
                    document.getElementById("openedUzi").style.display = 'block';
                    document.getElementById("openedUzi").style.top = '250px';
                    document.getElementById("openedUzi").style.left = '530px';
                    document.getElementById("openedUzi").style.fontSize = '33px';
                    document.getElementById("openedUzi").style.color = 'green';
                    setTimeout(function () {
                        document.getElementById("openedUzi").style.display = 'none';
                    }, 3000);
                }
            }
            if (this.level >= 4) {
                document.getElementById('shotgun').style.display = 'block';
                if (this.level === 4) {
                    document.getElementById("openedShotgun").style.display = 'block';
                    document.getElementById("openedShotgun").style.top = '250px';
                    document.getElementById("openedShotgun").style.left = '530px';
                    document.getElementById("openedShotgun").style.fontSize = '33px';
                    document.getElementById("openedShotgun").style.color = 'green';
                    setTimeout(function () {
                        document.getElementById("openedShotgun").style.display = 'none';
                    }, 3000);
                }
            }
            this.newLevel = true;
            document.getElementById("levelToChange").style.display = 'block';
            document.getElementById("levelToChange").innerHTML = 'Level ' + this.level;
            document.getElementById("levelToChange").style.top = '200px';
            document.getElementById("levelToChange").style.left = '630px';
            document.getElementById("levelToChange").style.fontSize = '33px';
            document.getElementById("levelToChange").style.color = 'black';
            document.getElementById("level").innerHTML = 'Level: ' + this.level;

            setTimeout(function () {
                document.getElementById("levelToChange").style.display = 'none';
            },3000);
        }
    },
    draw: function (ctx) {
        for (var a = 0; a < this.onlytodraw.length; a++) {
            this.onlytodraw[a].draw(ctx);
        }
        for (var e = 0; e < this.entities.length; e++) {
            if (!this.entities[e].name.match(/spawn/))
                this.entities[e].draw(ctx);
        }
    },
    loadAll: function () {
        soundManager.init();
        soundManager.loadArray(['music/attack.mp3','music/Fon.mp3','music/fon2.mp3','music/colt_shoot.mp3','music/no_ammo.mp3','music/reload.mp3'
            ,'music/uzi_shoot.mp3','music/shotgun_shoot.mp3','music/cant_use.mp3','music/took_gun.mp3']);
        soundManager.play('music/fon2.mp3', {looping: true, volume: 1});
        soundManager.play('music/Fon.mp3',{looping: true, volume: 1});
        mapManager.loadMap("json/map.json"); // загрузка карты
        spriteManager.loadAtlas("json/atlas.json", "images/sprite.png"); // загрузка атласа
        gameManager.factory['Player'] = Player; // инициализация фабрики
        gameManager.factory['Zombie'] = Zombie;
        gameManager.factory['Box'] = Box;
        gameManager.factory['Bullet'] = Bullet;
        gameManager.factory['Spawn'] = Spawn;
        mapManager.parseEntities(); // разбор сущностей карты
        mapManager.draw(ctx); // отобразить карту
        eventsManager.setup(); // настройка событий
    },
    play: function () {
        gameManager.loadAll();
        setInterval(updateWorld, 100);
    }
};


///////////////////////////////////////////////
/////////////////SOUND MANAGER/////////////////
//////////////////////////////////////////////
var soundManager = {
    clips: {}, // звуковые эффекты
    context: null, // аудиоконтекст
    gainNode: null, // главный узел
    loaded: false, // все звуки загружены
    init: function () {
        // инициализация
        this.context = new AudioContext();
        this.gainNode = this.context.createGain ? this.context.createGain() : this.context.createGainNode();
        this.gainNode.connect(this.context.destination);
    },
    load: function (path, callback) { // загрузка одного аудиовъфайла
        if (this.clips[path]) {
            callback(this.clips[path]);
            return;
        }
        var clip = {path: path, buffer: null, loaded: false};
        clip.play = function (volume, loop) {
            soundManager.play(this.path,{looping: loop?loop:false, volume: volume ? volume:1});

        };
        this.clips[path] = clip;
        var request = new XMLHttpRequest();
        request.open("GET", path, true);
        request.responseType = 'arraybuffer';
        request.onload = function () {
            soundManager.context.decodeAudioData(request.response, function (buffer) {
                clip.buffer = buffer;
                clip.loaded = true;
                callback(clip);
            });
        };
        request.send();
    },
    loadArray: function (array) {
        // загрузка массива звуков
        for (var i = 0; i < array.length; i++) {
            soundManager.load(array[i], function () {
                if (array.length === Object.keys(soundManager.clips).length) {
                    for (var sd in soundManager.clips)
                        if (!soundManager.clips[sd].loaded) return;
                    soundManager.loaded = true;
                }
            });
        }
    },
    play: function (path, settings) {
        if (!soundManager.loaded) {
            setTimeout(function () {
                soundManager.play(path,settings);
            }, 1000);
            return;
        }
        var looping = false;
        var volume = 1;
        if (settings) {
            if (settings.looping)
                looping = settings.looping;
            if (settings.volume)
                volume = settings.volume;
        }
        var sd = this.clips[path];
        if (sd === null) return false;
        // создаем нвоый экземпляр проигрывателя BufferSOurce
        var sound = soundManager.context.createBufferSource();
        sound.buffer = sd.buffer;
        sound.connect(soundManager.gainNode);
        sound.loop = looping;
        soundManager.gainNode.gain.value = volume;
        sound.start(0);
        return true;
    },
    stopAll: function () {
        this.gainNode.disconnect();
    }
};

function updateWorld() {
    gameManager.update();
}
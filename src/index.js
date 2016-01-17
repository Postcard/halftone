/* @flow */

/**
 * Module dependencies.
 */
 import fs from 'fs';
 import path from 'path';
 import GM from 'gm';
 import paper from 'paper';


 const gm = GM.subClass({
 	imageMagick: true
 });


export type Options = {
	/**
	* Size of the output image
	*/
	size: number,

	/**
	* Number of pixels per grid cell
	*/
	density: ?number,

	/**
	* Factor of spacing between circles
	*/
	spacing: ?number,

	/**
	* Quality of the file compression
	*/
	quality: ?number,

	/**
	* output file
	*/
	outputFile: ?string,

	/**
	* 'png' or 'jpg'
	*/
	extension: ?string
}

/*
* Rotation of the halftone in degree
*/
const alpha = 45

const sqrt2 = Math.sqrt(2);


/**
 * @summary Convert a square image to a 45° angle circle shaped halftone  
 *
 * @param image: A file stream or a path to an image
 * @param options
 * @returns Promise<Object|String>: a stream or a file path
*/
export default function halftone(image: Object | string, options: Options) {

	options.spacing = options.spacing || 1.0;
	options.density = options.density || 10;
	options.quality = options.quality || 100;

	if (options.outputFile) {
		options.extension = path.extname(options.outputFile);
	}


	let { size, density, spacing, quality, outputFile, extension } = options;

	return new Promise((resolve, reject) => {

		// rotate the image 45°
		gm(image).rotate('grey', alpha).toBuffer('JPEG', (err, rotated) => {
			
			if (err) {
				reject(err);
			}

 			const base64Im = "data:image/jpeg;base64," + rotated.toString('base64');

 			const canvasSize = (size + 2 * density) * sqrt2;

			let canvas = new paper.Canvas(canvasSize, canvasSize);

			paper.setup(canvas);

			// set background color to white
			const rectangle = new paper.Rectangle(0, 0, canvasSize, canvasSize);
			let path = new paper.Path.Rectangle(rectangle);
			path.fillColor = 'white'				

			let raster = new paper.Raster(base64Im);
 			const radius = density / 2 / spacing;

			raster.onLoad = () => {

				raster.size = new paper.Size(canvasSize / density, canvasSize / density);
				raster.visible = false;

				for (let y = 0; y < raster.height; y++) {
					for (let x = 0; x < raster.width; x++) {
						// Get the color of the pixel:
						const color = raster.getPixel(x, y);

						// Create a circle shaped path:
						let path = new paper.Path.Circle({
							center: new paper.Point(x * density, y * density),
							radius: radius,
							fillColor: 'black'
						});

						// Scale the path by the amount of gray in the pixel color:
						let scale = 1.0 - color.gray;
						let sign = scale > 0.5 ? 1 : -1; 
						path.scale(sign * Math.pow(sign * (scale - 0.5), 1.2) + 0.5);
					}
				}

				paper.view.update();

				let stream = canvas.jpegStream({quality: quality});
				const offset = (size / 2) + 2 * density;

				let output = gm(stream)
					.rotate('grey', - alpha)
					.repage('+')
					.crop(size, size, offset, offset)
					.strip()

				if (!outputFile) {
					output.stream(extension, (err, stdout, stderr) => {
						if (err) {
							reject(err);
						}
						resolve(stdout);
					})
				} else {

					let writeStream = fs.createWriteStream(outputFile);
					output
						.stream(extension)
						.pipe(writeStream)
						.on('finish', () => {
							paper.project.clear();
							resolve(outputFile);
						});
				}
			}

		});
	});
}
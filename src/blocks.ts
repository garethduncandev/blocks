interface Column {
  startX: number;
  startY: number;
  fill: boolean;
  blockWidth: number;
}

export default class Blocks {
  private previousClassName: string | undefined = undefined;

  public constructor(
    private blockHeight: number,
    private codeBlockMinWidth: number,
    private codeBlockMaxWidth: number,
    private padding: number,
    private styleVariationsCount: number
  ) {}

  public create(id: string, image: HTMLImageElement): SVGSVGElement {
    const context = this.createContext(image.width, image.height);
    context.drawImage(image, 0, 0);
    const rowsCount = image.height / this.blockHeight;
    const columnsCount = image.width / this.codeBlockMinWidth;

    const result = this.createSVGRectElements(
      context,
      rowsCount,
      columnsCount,
      this.codeBlockMinWidth,
      this.codeBlockMaxWidth
    );

    const outputSvg = this.createSVGElement(image.width, image.height, id);

    outputSvg.getElementById(`${id}-code-blocks-group`)?.append(...result);

    return outputSvg;
  }

  private createSVGElement(
    width: number,
    height: number,
    id: string
  ): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:svg', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const elementNS = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    );
    elementNS.setAttribute('id', `${id}-code-blocks-group`);
    svg.appendChild(elementNS);
    return svg;
  }

  private createContext(
    canvasWidth: number,
    canvasHeight: number
  ): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not get context');
    }
    return context;
  }

  private createSVGRectElements(
    context: CanvasRenderingContext2D,
    rowsCount: number,
    columnsCount: number,
    codeBlockMinWidth: number,
    codeBlockMaxWidth: number
  ): SVGRectElement[] {
    // work through each row
    let startY = 0;

    const svgElements: SVGRectElement[] = [];
    // work through each column
    for (let y = 0; y < rowsCount; y++) {
      // create svg elements
      const svgRowColumnElements = this.createRowColumnSvgElements(
        context,
        columnsCount,
        startY,
        codeBlockMinWidth,
        codeBlockMaxWidth
      );
      svgElements.push(...svgRowColumnElements);

      startY += this.blockHeight;
    }
    return svgElements;
  }

  private createRowColumnSvgElements(
    context: CanvasRenderingContext2D,
    columnsCount: number,
    startY: number,
    codeBlockMinWidth: number,
    codeBlockMaxWidth: number
  ): SVGRectElement[] {
    let columns = this.splitRowIntoColumns(context, columnsCount, startY);

    // merge filled columns next to each other together
    // this allows us to calculate the min and max length to work with
    columns = this.mergeRowColumns(columns);

    // split columns into random length blocks for code effect
    columns = this.splitColumnsIntoRandomLengthColumns(
      columns,
      codeBlockMinWidth,
      codeBlockMaxWidth
    );

    // create svg elements
    const svgRowColumnElements = this.createSvgElements(columns);
    return svgRowColumnElements;
  }

  private splitRowIntoColumns(
    context: CanvasRenderingContext2D,
    columnsCount: number,
    startY: number
  ): Column[] {
    let startX = 0;
    const columns: Column[] = [];
    for (let x = 0; x < columnsCount; x++) {
      const pixelsContainColor = this.areaContainsColour(
        context,
        startX,
        startY,
        this.codeBlockMinWidth,
        this.blockHeight
      );

      columns.push({
        startX,
        startY,
        fill: pixelsContainColor,
        blockWidth: this.codeBlockMinWidth,
      });
      startX += this.codeBlockMinWidth;
    }
    return columns;
  }

  private mergeRowColumns(columns: Column[]): Column[] {
    const mergedColumns: Column[] = [];

    for (let x = 0; x < columns.length; x++) {
      const currentColumn = columns[x];

      if (currentColumn.fill) {
        let nextIndex = x + 1;
        let nextColumn = columns[nextIndex];

        while (
          nextColumn &&
          nextColumn.fill &&
          nextColumn.startX === currentColumn.startX + currentColumn.blockWidth
        ) {
          currentColumn.blockWidth += nextColumn.blockWidth;
          nextIndex++;
          nextColumn = columns[nextIndex];
        }

        mergedColumns.push(currentColumn);
        x = nextIndex - 1;
      } else {
        mergedColumns.push(currentColumn);
      }
    }

    return mergedColumns;
  }

  private splitColumnsIntoRandomLengthColumns(
    columns: Column[],
    codeBlockMinWidth: number,
    codeBlockMaxWidth: number
  ): Column[] {
    const result: Column[] = [];
    for (let x = 0; x < columns.length; x++) {
      const blockWidth = columns[x].blockWidth;
      const newBlockWidths = this.createRandomBlockWidths(
        blockWidth,
        codeBlockMinWidth,
        codeBlockMaxWidth
      );

      let newStartX = columns[x].startX;

      for (let w = 0; w < newBlockWidths.length; w++) {
        const width = newBlockWidths[w];

        const newColumn: Column = {
          fill: true,
          startY: columns[x].startY,
          startX: newStartX,
          blockWidth: width,
        };

        newStartX += width;
        result.push(newColumn);
      }
    }
    return result;
  }

  private areaContainsColour(
    context: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    blockWidth: number,
    blockHeight: number
  ): boolean {
    const pixelData = context.getImageData(
      startX,
      startY + Math.floor(blockHeight / 2),
      blockWidth,
      1
    ).data;

    let notWhiteOrTransparent = false;
    for (let i = 0; i < pixelData.length; i += 4) {
      const red = pixelData[i];
      const green = pixelData[i + 1];
      const blue = pixelData[i + 2];
      const alpha = pixelData[i + 3];

      // if 100% transparent, ignore even if it has color
      if (alpha === 0) {
        continue;
      }

      if (red < 255 || green < 255 || blue < 255) {
        notWhiteOrTransparent = true;
        break;
      }
    }
    return notWhiteOrTransparent;
  }

  private createSvgElements(columns: Column[]): SVGRectElement[] {
    const rectangles: SVGRectElement[] = [];

    for (let x = 0; x < columns.length; x++) {
      const fill = columns[x].fill;
      if (fill) {
        const rect = this.createRectangle(
          columns[x].startX,
          columns[x].startY,
          columns[x].blockWidth,
          this.blockHeight,
          this.styleVariationsCount
        );
        rectangles.push(rect);
      }
    }

    return rectangles;
  }

  private createRectangle(
    startX: number,
    startY: number,
    codeBlockWidth: number,
    codeBlockHeight: number,
    styleVariationsCount: number
  ): SVGRectElement {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', (codeBlockWidth - this.padding).toString());
    rect.setAttribute('height', (codeBlockHeight - this.padding).toString());
    rect.setAttribute('x', startX.toString());
    rect.setAttribute('y', startY.toString());

    const className = this.calculateRectClassName(
      codeBlockWidth,
      styleVariationsCount
    );
    rect.setAttribute('class', className);

    return rect;
  }

  private calculateRectClassName(
    blockWidth: number,
    styleVariationsCount: number
  ): string {
    let className: string = '';

    do {
      const randomVariation =
        Math.floor(Math.random() * styleVariationsCount) + 1;
      className = `block-width-${Math.floor(
        blockWidth / this.codeBlockMinWidth
      )} block-variation-${randomVariation}`;
      continue;
    } while (this.previousClassName === className);
    this.previousClassName = className;
    return className;
  }

  private createRandomBlockWidths(
    sum: number,
    codeBlockMinWidth: number,
    codeBlockMaxWidth: number
  ): number[] {
    const numberOfBlocks = Math.floor(sum / codeBlockMinWidth);

    const availableWidths = Array.from(Array(numberOfBlocks).keys()).map(
      (m) => m * codeBlockMinWidth
    );

    const numbers: number[] = [];
    let remainingSum = sum;
    let previousRandomNumber = 0;
    while (remainingSum > codeBlockMinWidth) {
      let randomNumber = 0;
      do {
        randomNumber = this.generateRandomNumber(
          availableWidths,
          codeBlockMinWidth,
          codeBlockMaxWidth
        );
      } while (
        randomNumber === previousRandomNumber ||
        randomNumber > remainingSum
      );
      previousRandomNumber = randomNumber;

      numbers.push(randomNumber);
      remainingSum -= randomNumber;
    }

    return numbers;
  }

  private generateRandomNumber(
    availableWidths: number[],
    codeBlockMinWidth: number,
    codeBlockMaxWidth: number
  ): number {
    let randomNumber: number;
    do {
      const randomIndex = Math.floor(Math.random() * availableWidths.length);
      randomNumber = availableWidths[randomIndex];
    } while (
      randomNumber < codeBlockMinWidth ||
      randomNumber > codeBlockMaxWidth
    );
    return randomNumber;
  }
}

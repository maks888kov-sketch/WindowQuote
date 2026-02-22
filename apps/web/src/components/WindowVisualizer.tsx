type WindowVisualizerProps = {
  width: number;
  height: number;
  sections: number;
  type?: string;
  openingType?: string;
};

export default function WindowVisualizer({ width, height, sections, openingType = "tilt-turn" }: WindowVisualizerProps) {
  const maxWidth = 400;
  const maxHeight = 300;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const displayWidth = width * scale;
  const displayHeight = height * scale;

  const sectionWidth = displayWidth / sections;

  const getOpeningSymbol = (index: number) => {
    if (openingType === "fixed") return null;
    if (openingType === "tilt")
      return (
        <polygon
          points={`${sectionWidth / 2},${displayHeight * 0.1} ${sectionWidth * 0.1},${displayHeight * 0.9} ${sectionWidth * 0.9},${displayHeight * 0.9}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="4,2"
        />
      );
    if (openingType === "turn" || openingType === "tilt-turn") {
      const isLeft = index % 2 === 0;
      return (
        <>
          <line
            x1={isLeft ? sectionWidth * 0.1 : sectionWidth * 0.9}
            y1={displayHeight * 0.1}
            x2={sectionWidth / 2}
            y2={displayHeight / 2}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="4,2"
          />
          <line
            x1={isLeft ? sectionWidth * 0.1 : sectionWidth * 0.9}
            y1={displayHeight * 0.9}
            x2={sectionWidth / 2}
            y2={displayHeight / 2}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="4,2"
          />
          {openingType === "tilt-turn" && (
            <polygon
              points={`${sectionWidth / 2},${displayHeight * 0.15} ${sectionWidth * 0.15},${displayHeight * 0.85} ${sectionWidth * 0.85},${displayHeight * 0.85}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          )}
        </>
      );
    }
    return null;
  };

  return (
    <div className="window-visualizer">
      <svg
        width={displayWidth + 40}
        height={displayHeight + 60}
        className="window-visualizer-svg"
      >
        <g transform="translate(20, 20)">
          <rect
            x="0"
            y="0"
            width={displayWidth}
            height={displayHeight}
            fill="none"
            stroke="#374151"
            strokeWidth="8"
            rx="2"
          />
          <rect
            x="8"
            y="8"
            width={displayWidth - 16}
            height={displayHeight - 16}
            fill="none"
            stroke="#6b7280"
            strokeWidth="4"
            rx="1"
          />
          {Array.from({ length: sections }).map((_, index) => (
            <g key={index} transform={`translate(${index * sectionWidth}, 0)`}>
              {index > 0 && (
                <line
                  x1="0"
                  y1="8"
                  x2="0"
                  y2={displayHeight - 8}
                  stroke="#6b7280"
                  strokeWidth="6"
                />
              )}
              <rect
                x={index === 0 ? 12 : 6}
                y="12"
                width={sectionWidth - (index === 0 ? 18 : 12) - (index === sections - 1 ? 6 : 0)}
                height={displayHeight - 24}
                fill="rgba(135, 206, 250, 0.3)"
                stroke="#9ca3af"
                strokeWidth="1"
              />
              <g transform={`translate(${index === 0 ? 12 : 6}, 12)`}>
                <svg
                  width={sectionWidth - (index === 0 ? 18 : 12) - (index === sections - 1 ? 6 : 0)}
                  height={displayHeight - 24}
                >
                  {getOpeningSymbol(index)}
                </svg>
              </g>
              {openingType !== "fixed" && (
                <rect
                  x={sectionWidth * 0.85}
                  y={displayHeight * 0.45}
                  width="4"
                  height={displayHeight * 0.1}
                  fill="#374151"
                  rx="1"
                />
              )}
            </g>
          ))}
        </g>
        <g transform="translate(20, 0)">
          <line x1="0" y1={displayHeight + 35} x2={displayWidth} y2={displayHeight + 35} stroke="#6b7280" strokeWidth="1" />
          <line x1="0" y1={displayHeight + 30} x2="0" y2={displayHeight + 40} stroke="#6b7280" strokeWidth="1" />
          <line x1={displayWidth} y1={displayHeight + 30} x2={displayWidth} y2={displayHeight + 40} stroke="#6b7280" strokeWidth="1" />
          <text x={displayWidth / 2} y={displayHeight + 50} textAnchor="middle" className="window-visualizer-text">
            {width} мм
          </text>
        </g>
        <g transform="translate(0, 20)">
          <line x1="10" y1="0" x2="10" y2={displayHeight} stroke="#6b7280" strokeWidth="1" />
          <line x1="5" y1="0" x2="15" y2="0" stroke="#6b7280" strokeWidth="1" />
          <line x1="5" y1={displayHeight} x2="15" y2={displayHeight} stroke="#6b7280" strokeWidth="1" />
          <text
            x="8"
            y={displayHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, 8, ${displayHeight / 2})`}
            className="window-visualizer-text"
          >
            {height} мм
          </text>
        </g>
      </svg>
      <div className="window-visualizer-summary">
        <span>Секций: {sections}</span>
        <span>Площадь: {((width * height) / 1_000_000).toFixed(2)} м²</span>
        <span>Периметр: {((width + height) * 2 / 1000).toFixed(2)} м</span>
      </div>
    </div>
  );
}

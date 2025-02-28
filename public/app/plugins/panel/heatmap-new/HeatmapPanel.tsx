import { css } from '@emotion/css';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { DataFrameType, GrafanaTheme2, PanelProps, reduceField, ReducerID, TimeRange } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import {
  Portal,
  UPlotChart,
  useStyles2,
  useTheme2,
  VizLayout,
  VizTooltipContainer,
  LegendDisplayMode,
} from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';

import { HeatmapHoverView } from './HeatmapHoverView';
import { prepareHeatmapData } from './fields';
import { PanelOptions } from './models.gen';
import { quantizeScheme } from './palettes';
import { HeatmapHoverEvent, prepConfig } from './utils';

interface HeatmapPanelProps extends PanelProps<PanelOptions> {}

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  data,
  id,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  // ugh
  let timeRangeRef = useRef<TimeRange>(timeRange);
  timeRangeRef.current = timeRange;

  const info = useMemo(() => prepareHeatmapData(data, options, theme), [data, options, theme]);

  const facets = useMemo(() => [null, info.heatmap?.fields.map((f) => f.values.toArray())], [info.heatmap]);

  //console.log(facets);

  const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);

  const [hover, setHover] = useState<HeatmapHoverEvent | undefined>(undefined);
  const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState<boolean>(false);
  const isToolTipOpen = useRef<boolean>(false);

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    setShouldDisplayCloseButton(false);
    onhover(null);
  };

  const onclick = () => {
    isToolTipOpen.current = !isToolTipOpen.current;

    // Linking into useState required to re-render tooltip
    setShouldDisplayCloseButton(isToolTipOpen.current);
  };

  const onhover = useCallback(
    (evt?: HeatmapHoverEvent | null) => {
      setHover(evt ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, data.structureRev]
  );

  // ugh
  const dataRef = useRef(info);
  dataRef.current = info;

  const builder = useMemo(() => {
    return prepConfig({
      dataRef,
      theme,
      onhover: onhover,
      onclick: options.tooltip.show ? onclick : null,
      onzoom: (evt) => {
        onChangeTimeRange({ from: evt.xMin, to: evt.xMax });
      },
      isToolTipOpen,
      timeZone,
      getTimeRange: () => timeRangeRef.current,
      palette,
      cellGap: options.cellGap,
      hideThreshold: options.hideThreshold,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data.structureRev]);

  const renderLegend = () => {
    if (options.legend.displayMode === LegendDisplayMode.Hidden || !info.heatmap) {
      return null;
    }

    let heatmapType = dataRef.current?.heatmap?.meta?.type;
    let countFieldIdx = heatmapType === DataFrameType.HeatmapScanlines ? 2 : 3;
    const countField = info.heatmap.fields[countFieldIdx];

    const { min, max } = reduceField({ field: countField, reducers: [ReducerID.min, ReducerID.max] });

    let hoverValue: number | undefined = undefined;
    if (hover && info.heatmap.fields) {
      hoverValue = countField.values.get(hover.index);
    }

    return (
      <VizLayout.Legend placement="bottom" maxHeight="20%">
        <div className={styles.colorScaleWrapper}>
          <ColorScale hoverValue={hoverValue} colorPalette={palette} min={min} max={max} display={info.display} />
        </div>
      </VizLayout.Legend>
    );
  };

  if (info.warning || !info.heatmap) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        needsNumberField={true}
        message={info.warning}
      />
    );
  }

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart config={builder} data={facets as any} width={vizWidth} height={vizHeight} timeRange={timeRange}>
            {/*children ? children(config, alignedFrame) : null*/}
          </UPlotChart>
        )}
      </VizLayout>
      <Portal>
        {hover && options.tooltip.show && (
          <VizTooltipContainer
            position={{ x: hover.pageX, y: hover.pageY }}
            offset={{ x: 10, y: 10 }}
            allowPointerEvents={isToolTipOpen.current}
          >
            {shouldDisplayCloseButton && (
              <>
                <CloseButton onClick={onCloseToolTip} />
                <div className={styles.closeButtonSpacer} />
              </>
            )}
            <HeatmapHoverView data={info} hover={hover} showHistogram={options.tooltip.yHistogram} />
          </VizTooltipContainer>
        )}
      </Portal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  closeButtonSpacer: css`
    margin-bottom: 15px;
  `,
  colorScaleWrapper: css`
    margin-left: 25px;
    padding: 10px 0;
  `,
});

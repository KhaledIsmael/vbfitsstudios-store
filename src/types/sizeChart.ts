export interface SizeChartColumn {
  id: string;
  label: string;
  unit?: string;
}

export interface SizeChartRow {
  size: string;
  measurements: Record<string, string | number>;
}

export interface SizeChartLayout {
  headerY?: number; // % from top
  colX?: Record<string, number>; // % from left for each col id (and 'size' for the size column)
  rowY?: Record<string, number>; // % from top for each row size
}

export interface ProductSizeChart {
  enabled: boolean;
  category: 't-shirt' | 'trousers' | 'hoodie' | 'custom' | string;
  unit: 'cm' | 'inch' | string;
  template_image_url?: string;
  image_url?: string;
  columns?: SizeChartColumn[];
  rows?: SizeChartRow[];
  layout?: SizeChartLayout;
  notes?: string;
  render_mode?: 'overlay' | 'table';
}

export const DEFAULT_TSHIRT_TEMPLATE_URL = '/assets/size-charts/tshirt-template.jpg';

// Preset matching the user's reference design
export const DEFAULT_TSHIRT_SIZE_CHART: ProductSizeChart = {
  enabled: true,
  category: 't-shirt',
  unit: 'cm',
  template_image_url: DEFAULT_TSHIRT_TEMPLATE_URL,
  render_mode: 'overlay',
  columns: [
    { id: 'length', label: 'Length' },
    { id: 'width', label: 'Width' },
    { id: 'sleeve_length', label: 'Sleeve length' }
  ],
  rows: [
    { size: 'S', measurements: { length: '71', width: '55', sleeve_length: '59' } },
    { size: 'M', measurements: { length: '73', width: '57', sleeve_length: '60' } },
    { size: 'L', measurements: { length: '75', width: '59', sleeve_length: '61' } },
    { size: 'XL', measurements: { length: '77', width: '61', sleeve_length: '62' } }
  ],
  layout: {
    headerY: 8.5,
    colX: {
      size: 13.5,
      length: 37,
      width: 56,
      sleeve_length: 80
    },
    rowY: {
      S: 17.5,
      M: 25.5,
      L: 33.5,
      XL: 41.5
    }
  },
  notes: 'All measurements are taken flat in centimeters. Designed with a contemporary boxy fit.'
};

export const DEFAULT_TROUSERS_SIZE_CHART: ProductSizeChart = {
  enabled: true,
  category: 'trousers',
  unit: 'cm',
  template_image_url: '',
  render_mode: 'table',
  columns: [
    { id: 'waist', label: 'Waist' },
    { id: 'hip', label: 'Hip' },
    { id: 'length', label: 'Length' },
    { id: 'inseam', label: 'Inseam' },
    { id: 'leg_opening', label: 'Leg opening' }
  ],
  rows: [
    { size: 'S', measurements: { waist: '76', hip: '102', length: '104', inseam: '76', leg_opening: '22' } },
    { size: 'M', measurements: { waist: '81', hip: '107', length: '106', inseam: '77', leg_opening: '23' } },
    { size: 'L', measurements: { waist: '86', hip: '112', length: '108', inseam: '78', leg_opening: '24' } },
    { size: 'XL', measurements: { waist: '91', hip: '117', length: '110', inseam: '79', leg_opening: '25' } }
  ],
  notes: 'Measurements in cm taken flat. Tailored relaxed drape.'
};

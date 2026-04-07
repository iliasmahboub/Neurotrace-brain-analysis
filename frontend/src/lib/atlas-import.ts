import type { AtlasQcSummary, AtlasRegionSummaryRow } from '../types';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export async function parseAtlasQcSummary(file: File): Promise<AtlasQcSummary> {
  const payload = JSON.parse(await file.text()) as AtlasQcSummary;
  return payload;
}

export async function parseAtlasSummaryRows(file: File): Promise<AtlasRegionSummaryRow[]> {
  const rows = parseCsv(await file.text());
  return rows.map(row => ({
    image_name: row.image_name ?? '',
    atlas_name: row.atlas_name ?? '',
    slice_index: row.slice_index ?? '',
    hemisphere: row.hemisphere ?? '',
    region_id: row.region_id ?? '',
    region_acronym: row.region_acronym ?? '',
    region_name: row.region_name ?? '',
    hierarchy_level: row.hierarchy_level,
    child_region_count: row.child_region_count,
    cell_count: row.cell_count ?? '0',
    atlas_resolution_um: row.atlas_resolution_um ?? '',
    pixel_area_um2: row.pixel_area_um2 ?? '',
    region_area_px: row.region_area_px ?? '',
    region_area_um2: row.region_area_um2 ?? '',
    cell_density_per_mm2: row.cell_density_per_mm2 ?? '',
  }));
}

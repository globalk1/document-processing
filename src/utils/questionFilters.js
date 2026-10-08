export const filterValues = value => Array.isArray(value) ? value : [value];
export const filterParam = value => {
  const values = filterValues(value).filter(item => item && !['__none__', '__all__'].includes(item));
  return Array.isArray(value) ? values : values[0] || '';
};
export const filterMatches = (value, candidate) => {
  const selected = filterParam(value);
  return Array.isArray(selected) ? !selected.length || selected.includes(candidate) : !selected || selected === candidate;
};
export function reconcileUnits(value, grade, units, getGrade, fallback = '') {
  if (grade === '__none__') return '__none__';
  const valid = filterValues(value).filter(id => id && !['__none__', '__all__'].includes(id) &&
    units.some(unit => unit.id === id && filterMatches(grade, getGrade(unit))));
  return valid.length ? (Array.isArray(value) ? valid : valid[0]) : fallback;
}
export function singleFilterValue(value) {
  const values = filterValues(filterParam(value)).filter(Boolean);
  return values.length === 1 ? values[0] : '';
}

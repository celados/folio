export const query = `
  select city, cast(sum(trips * ?) as integer) as trips
  from trips
  group by city
  order by city
`

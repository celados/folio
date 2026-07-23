import { ResourceFile } from '../../index.ts'
import { arquero } from '../../readers/arquero.ts'

void ResourceFile('data:text/csv,city%0ATokyo', { name: 'cities.csv' }).read(arquero())
void ResourceFile('data:application/json,%5B%7B%22city%22%3A%22Paris%22%7D%5D', {
  name: 'cities.json',
}).read(arquero())

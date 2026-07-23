import { ResourceFile } from '../../index.ts'
import { arquero } from '../../readers/arquero.ts'
import { arrow } from '../../readers/arrow.ts'
import { parquet } from '../../readers/parquet.ts'
import { xlsx } from '../../readers/xlsx.ts'
import { zip } from '../../readers/zip.ts'

const file = ResourceFile('/fixture.bin')

void file.read(arrow)
void file.read(arquero())
void file.read(parquet)
void file.read(xlsx)
void file.read(zip)

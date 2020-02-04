# ts-gios
Type-safe TypeScript wrapper for [GIOŚ API](https://powietrze.gios.gov.pl/pjp/content/api).

## Example
```typescript
import { getAirQuality } from 'ts-gios';

const STATION_ID = 52;

getAirQuality(STATION_ID).then(
  ({ generalIndex, indexes }) => {
    console.log(`Status: ${generalIndex.indexLevel.name}`);
    console.log(
      indexes
        .map(({ name, indexLevel }) => `${name.toUpperCase()}: ${indexLevel.name}`)
        .join('\n')
    );
  }
);
```

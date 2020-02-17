import * as D from 'type-safe-json-decoder'
import { Decoder } from 'type-safe-json-decoder';
import { get } from 'request-promise-native';
import { zonedTimeToUtc } from 'date-fns-tz';

const API_BASE_URL = 'http://api.gios.gov.pl/pjp-api/rest';
const AVAILABLE_AQ_INDEXES = ['st', 'co', 'so2', 'pm10', 'pm25', 'o3', 'c6h6', 'no2'] as const;
const GENERAL_AQ_INDEX = 'st';

export type AirQuality = {
  stationId: number,
  generalIndex: AQGeneralIndex,
  indexes: AQIndex[],
}

type AQIndexName = (typeof AVAILABLE_AQ_INDEXES)[number];
type AQGeneralIndexName = typeof GENERAL_AQ_INDEX;

export type AQGeneralIndex = {
  name: AQGeneralIndexName,
  calcTime: number,
  sourceTime: number,
  indexLevel: AQIndexLevel,
}

export type AQIndex = {
  name: Exclude<AQIndexName, AQGeneralIndexName>,
  calcTime: number,
  sourceTime: number,
  indexLevel: AQIndexLevel,
}

export type AQIndexLevel = {
  id: number,
  name: string,
}

const PLDateStringToTimestampDecoder = D.andThen(
  D.string(), 
  potentialDateString => {
    const timestamp = zonedTimeToUtc(potentialDateString, 'Europe/Warsaw').getTime();

    return isNaN(timestamp) ?
      D.fail('Invalid date string') :
      D.succeed(timestamp);
  }
);

const timeDecoder = D.oneOf(
  D.number(),
  PLDateStringToTimestampDecoder
);

function airQualityIndexDecoder(fieldPrefix: AQGeneralIndexName): Decoder<AQGeneralIndex>;
function airQualityIndexDecoder(fieldPrefix: AQIndex['name']): Decoder<AQIndex>;
function airQualityIndexDecoder(fieldPrefix: AQIndexName): Decoder<AQIndex|AQGeneralIndex> {
  return D.object(
    [`${fieldPrefix}CalcDate`, timeDecoder],
    [`${fieldPrefix}SourceDataDate`, timeDecoder],
    [`${fieldPrefix}IndexLevel`, D.object(
      ['id', D.number()],
      ['indexLevelName', D.string()],
      (id, name) => ({ id, name })
    )],
    (calcTime, sourceTime, indexLevel) => ({ name: fieldPrefix, calcTime, sourceTime, indexLevel })
  );
}

const notNull = <T>(v: T): v is Exclude<T, null> => v !== null;

const airQualityIndexesDecoder: Decoder<AirQuality['indexes']> =
  D.map(
    (indexes: Array<AQIndex|null>) => indexes.filter(notNull),
    D.tuple.apply(null, AVAILABLE_AQ_INDEXES.map(
      prefix => prefix === GENERAL_AQ_INDEX ?
        D.succeed(null) :
        D.oneOf(airQualityIndexDecoder(prefix), D.succeed(null))
    ))
  );

const decodeAirQualityResponse = (response: unknown): AirQuality => ({
  stationId: D.at(['id'], D.number()).decodeAny(response),
  generalIndex: airQualityIndexDecoder(GENERAL_AQ_INDEX).decodeAny(response),
  indexes: AVAILABLE_AQ_INDEXES.map(
    (prefix) => prefix !== GENERAL_AQ_INDEX ?
      D.oneOf(airQualityIndexDecoder(prefix), D.succeed(null)).decodeAny(response) :
      null
  ).filter(notNull),
});

export const getAirQuality = (stationId: number): Promise<AirQuality> =>
  get(`${API_BASE_URL}/aqindex/getIndex/${stationId.toString()}`, { json: true })
    .then(decodeAirQualityResponse);
-- Seed Oklahoma public-access reservoirs from catalog batches 4 and 5.
--
-- water_type is intentionally 'freshwater':
-- the conditions API treats every non-freshwater record as marine.
--
-- spot_type identifies the physical waterbody classification.

with seed (
  name,
  description,
  lat,
  lng,
  water_type,
  spot_type,
  access_type,
  region
) as (
  values
    (
      'Lake of the Arbuckles',
      'Public reservoir southwest of Sulphur within Chickasaw National Recreation Area. Verify current park access, ramps, fees, seasonal restrictions, and Oklahoma fishing regulations before travel.',
      34.4490::double precision,
      -97.0560::double precision,
      'freshwater',
      'reservoir',
      'State park',
      'Southeast'
    ),
    (
      'Lake Murray',
      'Public spring-fed reservoir within Lake Murray State Park near Ardmore, with shoreline fishing, boat ramps, marinas, camping, and state-park recreation access. Verify current park fees, boating conditions, access hours, and Oklahoma fishing regulations before travel.',
      34.1100::double precision,
      -97.0650::double precision,
      'freshwater',
      'reservoir',
      'State park',
      'Southeast'
    ),
    (
      'Fort Cobb Reservoir',
      'Public reservoir north of Fort Cobb with Fort Cobb State Park recreation access, fishing jetties, campgrounds, shoreline fishing, and boat ramps. Verify current state-park access, fees, ramp conditions, and Oklahoma fishing regulations before travel.',
      35.1736::double precision,
      -98.4780::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Southwest'
    ),
    (
      'Tom Steed Reservoir',
      'Public reservoir northwest of Snyder in Kiowa County with public fishing, shoreline access, and boat-launch opportunities. Verify current lake level, ramp availability, local access conditions, fees, and Oklahoma fishing regulations before travel.',
      34.7667::double precision,
      -98.9844::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Southwest'
    ),
    (
      'Foss Reservoir',
      'USACE public reservoir west of Clinton with public recreation areas, camping, shoreline fishing, and boat-launch access. Verify current Corps access, campground status, ramp conditions, fees, and Oklahoma fishing regulations before travel.',
      35.5301::double precision,
      -99.1871::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Southwest'
    ),
    (
      'Waurika Lake',
      'Public reservoir north of Waurika with public recreation, shoreline fishing, and boat-launch access. Verify current lake access, ramp availability, fees, seasonal restrictions, and Oklahoma fishing regulations before travel.',
      34.1660::double precision,
      -98.0550::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Southwest'
    ),
    (
      'Lake Ellsworth',
      'City of Lawton public reservoir south of Apache with fishing piers and public recreation access. Verify current city access rules, lake levels, fishing-pier availability, fees, and Oklahoma fishing regulations before travel.',
      34.8224::double precision,
      -98.3537::double precision,
      'freshwater',
      'reservoir',
      'Fishing pier',
      'Southwest'
    ),
    (
      'Robert S. Kerr Reservoir',
      'USACE public reservoir on the Arkansas River near Sallisaw with public recreation areas, fishing access, boat ramps, campgrounds, and shoreline opportunities. Verify current Corps access, ramp conditions, fees, navigation conditions, and Oklahoma fishing regulations before travel.',
      35.3506::double precision,
      -94.8528::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Southeast'
    ),
    (
      'Lake Atoka',
      'Public water-supply reservoir near Atoka with designated public fishing and boat-launch access. Verify current city or lake authority rules, water-supply restrictions, fees, access hours, and Oklahoma fishing regulations before travel.',
      34.3880::double precision,
      -96.1330::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Southeast'
    ),
    (
      'Pine Creek Lake',
      'Public reservoir east of Broken Bow and west of Antlers with public shoreline fishing, recreation areas, camping, and boat-launch access. Verify current access, ramp conditions, fees, lake levels, and Oklahoma fishing regulations before travel.',
      34.1240::double precision,
      -94.6940::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Southeast'
    ),
    (
      'Altus-Lugert Reservoir',
      'Public reservoir near Quartz Mountain State Park with shoreline fishing, camping, public recreation facilities, boat access, and fishing opportunities. Verify current park access, water levels, fees, closures, and special fishing regulations before travel.',
      34.9251::double precision,
      -99.3023::double precision,
      'freshwater',
      'reservoir',
      'State park',
      'Southwest'
    ),
    (
      'Kaw Lake',
      'USACE public reservoir near Ponca City with public recreation areas, shoreline fishing, camping, and boat-launch access. Verify current Corps recreation-area access, ramp availability, fees, lake conditions, and Oklahoma fishing regulations before travel.',
      36.7780::double precision,
      -97.0700::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Northeast'
    ),
    (
      'Canton Lake',
      'USACE public reservoir near Canton with public recreation areas, shoreline fishing, camping, and boat-launch access. Verify current Corps access, lake level, ramp status, fees, and Oklahoma fishing regulations before travel.',
      36.1410::double precision,
      -98.5850::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Northwest'
    ),
    (
      'Heyburn Lake',
      'USACE public reservoir southwest of Sapulpa with boat-launch access, fishing, camping, picnic areas, swimming beach, and public recreation facilities. Verify current Corps access, ramp status, fees, seasonal conditions, and Oklahoma fishing regulations before travel.',
      35.9526::double precision,
      -96.3027::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Northeast'
    ),
    (
      'Lake Lawtonka',
      'City of Lawton public reservoir near the Wichita Mountains with designated public fishing, shoreline access, and boat-launch opportunities. Verify current city water-supply restrictions, lake access, fees, hours, and Oklahoma fishing regulations before travel.',
      34.7200::double precision,
      -98.5300::double precision,
      'freshwater',
      'reservoir',
      'Boat ramp',
      'Southwest'
    )
),

updated as (
  update public.fishing_spots as existing
  set
    description = seed.description,
    lat = seed.lat,
    lng = seed.lng,
    water_type = seed.water_type,
    spot_type = seed.spot_type,
    access_type = seed.access_type,
    region = seed.region,
    updated_at = now()
  from seed
  where lower(trim(existing.name)) = lower(trim(seed.name))
  returning existing.id, existing.name
)

insert into public.fishing_spots (
  name,
  description,
  lat,
  lng,
  water_type,
  spot_type,
  access_type,
  region
)
select
  seed.name,
  seed.description,
  seed.lat,
  seed.lng,
  seed.water_type,
  seed.spot_type,
  seed.access_type,
  seed.region
from seed
where not exists (
  select 1
  from public.fishing_spots as existing
  where lower(trim(existing.name)) = lower(trim(seed.name))
);

-- Add verified ADA access notes for Purcell Lake and Pauls Valley Lake.
UPDATE public.spots
SET notes = 'City-managed lake southwest of Purcell with fishing jetties, boat ramp, pavilions, and a designated swimming area. ADA accessible fishing dock, ADA restrooms, and ADA accessible fishing areas are documented. Verify current local access and Oklahoma fishing-license requirements.'
WHERE id = '51' OR name = 'Purcell Lake';

UPDATE public.spots
SET notes = 'City-managed lake northeast of Pauls Valley with campsites, boat ramps, and fishing jetties. Verified ADA accessible fishing access, ADA restrooms, and ADA parking are documented. Verify city permit requirements and current access before travel.'
WHERE id = '52' OR name = 'Pauls Valley Lake';
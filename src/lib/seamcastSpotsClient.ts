+import type { Spot } from "@/lib/mapFilters";
+
+// Live data model returned by the Seamcast Spots API
+export interface LiveSpot {
+  id?: string;
+  name?: string;
+  lat?: number;
+  lon?: number;
+  latitude?: number;
+  longitude?: number;
+  waterType?: string;
+  spotType?: string;
+  accessType?: string;
+  region?: string;
+  source?: string;
+  notes?: string;
+  description?: string;
+  [k: string]: any;
+}
+
+// Adapter: map a LiveSpot to the apps

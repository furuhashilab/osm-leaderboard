export interface UserStats {
  username: string;
  totalChangesets: number;
  totalChanges: number;       // sum of changes_count across changesets
  buildingsAdded: number;     // from Overpass
  wheelchairMapped: number;   // from Overpass
  hashtagChangesets: number;  // changesets with any of the configured hashtags
  score: number;              // computed: totalChanges + buildingsAdded*5 + wheelchairMapped*3 + hashtagChangesets*2
  lastChangeset?: {
    id: string;
    createdAt: Date;
    bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number };
    comment: string;
  };
  profileUrl: string;         // https://www.openstreetmap.org/user/{username}
  rank: number;
}

export type Period = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'All Time';

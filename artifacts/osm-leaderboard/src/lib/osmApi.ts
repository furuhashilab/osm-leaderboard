// OSM Changeset API utility

export interface Changeset {
  id: string;
  created_at: string;
  changes_count: number;
  min_lat?: number;
  min_lon?: number;
  max_lat?: number;
  max_lon?: number;
  comment: string;
  hashtags: string[];
}

export async function fetchUserChangesets(username: string): Promise<Changeset[]> {
  const url = `https://api.openstreetmap.org/api/0.6/changesets?display_name=${encodeURIComponent(username)}&limit=100`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return []; // User might not have changesets or doesn't exist
      throw new Error(`Failed to fetch changesets for ${username}: ${response.statusText}`);
    }
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    
    const changesetElements = doc.querySelectorAll("changeset");
    const changesets: Changeset[] = [];
    
    changesetElements.forEach(el => {
      const id = el.getAttribute("id") || "";
      const created_at = el.getAttribute("created_at") || "";
      const changes_count = parseInt(el.getAttribute("changes_count") || "0", 10);
      
      const min_lat = el.hasAttribute("min_lat") ? parseFloat(el.getAttribute("min_lat")!) : undefined;
      const min_lon = el.hasAttribute("min_lon") ? parseFloat(el.getAttribute("min_lon")!) : undefined;
      const max_lat = el.hasAttribute("max_lat") ? parseFloat(el.getAttribute("max_lat")!) : undefined;
      const max_lon = el.hasAttribute("max_lon") ? parseFloat(el.getAttribute("max_lon")!) : undefined;
      
      let comment = "";
      const hashtags: string[] = [];
      
      const tags = el.querySelectorAll("tag");
      tags.forEach(tag => {
        if (tag.getAttribute("k") === "comment") {
          comment = tag.getAttribute("v") || "";
          
          // extract hashtags from comment
          const words = comment.split(/\s+/);
          words.forEach(word => {
            if (word.startsWith("#")) {
              hashtags.push(word.toLowerCase());
            }
          });
        }
      });
      
      changesets.push({
        id,
        created_at,
        changes_count,
        min_lat,
        min_lon,
        max_lat,
        max_lon,
        comment,
        hashtags
      });
    });
    
    return changesets;
  } catch (error) {
    console.error(`Error fetching changesets for ${username}:`, error);
    throw error;
  }
}

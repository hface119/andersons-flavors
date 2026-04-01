export interface FlavorItem {
  id: string;
  name: string;
  slug: string;
  locationId: string;
  startDate: string;
  endDate: string;
  className: string;
  allDay: boolean;
  isDraft: boolean;
  isArchived: boolean;
  lastPublished: string | null;
}

export interface PendingChange {
  type: "create" | "update" | "delete";
  item: FlavorItem;
  originalItem?: FlavorItem;
}

export interface SyncPayload {
  creates: FlavorItem[];
  updates: FlavorItem[];
  deletes: string[];
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  published: number;
  errors: string[];
}

/** One entry in the player's inbox. */
export interface GameMessage {
  id: number;
  text: string;
  isRead: boolean;
  dateStr: string;
  details?: {
    title: string;
    source: string;
    content: string;
  };
}

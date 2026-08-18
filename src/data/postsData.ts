export interface Post {
  id: number;
  title: string;
  date: string;
  text: string;
  imageUrl?: string;
  link: string;
  slug: string;
}

export const postsData: Post[] = [
  {
    "id": 1787075811085,
    "title": "Пост #1",
    "date": "2026-08-18T17:56:51.044Z",
    "text": "",
    "imageUrl": null,
    "link": "https://vk.ru/wall-223846998_1334",
    "slug": "post-1787075811085"
  }
];
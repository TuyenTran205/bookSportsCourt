import { Injectable, NotFoundException } from "@nestjs/common";
import { FavoritesRepository } from "./favorites.repository.js";

@Injectable()
export class FavoritesService {
  constructor(private readonly repo: FavoritesRepository) {}

  async list(userId: string) {
    return this.repo.listUserFavorites(userId);
  }

  async add(userId: string, venueId: string) {
    const success = await this.repo.addFavorite(userId, venueId);
    if (!success) {
      throw new NotFoundException({
        code: "VENUE_NOT_FOUND",
        message: "Cơ sở không tồn tại.",
      });
    }
    return { favorited: true };
  }

  async remove(userId: string, venueId: string) {
    await this.repo.removeFavorite(userId, venueId);
    return { favorited: false };
  }
}

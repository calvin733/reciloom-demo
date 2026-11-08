-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "parent_recipe_id" UUID;

-- CreateIndex
CREATE INDEX "recipes_parent_recipe_id_idx" ON "recipes"("parent_recipe_id");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_parent_recipe_id_fkey" FOREIGN KEY ("parent_recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

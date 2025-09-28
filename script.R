library(duckdb)
library(glue)

SPEEDY_PATH <- "/Volumes/acasis/speedy_output/edna_qc/parquet"
SPECIESGRIDS_PATH <- "/Volumes/acasis/speciesgrids/h3_7"
SPEEDY_RESOLUTION <- 3

evaluate_speedy <- function(observation) {
  file_path <- file.path(SPEEDY_PATH, paste0(observation$taxonID, ".parquet"))
  con <- dbConnect(duckdb())
  scores <- dbGetQuery(con, glue("
    INSTALL h3 FROM community;
    LOAD h3;
    select density, suitability from read_parquet('{file_path}')
    where h3 = h3_latlng_to_cell_string({observation$decimalLatitude}, {observation$decimalLongitude}, {SPEEDY_RESOLUTION})
  "))
  return(as.list(scores))
}

evaluate_speciesgrids <- function(observation) {
  # TODO: add distribution to speedy output and remove this plugin
  file_path <- file.path(SPECIESGRIDS_PATH, "*")
  con <- dbConnect(duckdb())
  cells <- dbGetQuery(con, glue("
    install h3 from community;
    load h3;
    select count(distinct(h3_cell_to_parent(cell, {SPEEDY_RESOLUTION}))) as cells from read_parquet('{file_path}')
    where AphiaID = {observation$taxonID}
  "))
  return(as.list(cells))
}

evaluate <- function(observation, plugins) {
  results <- observation
  for (plugin in plugins) {
    results <- c(results, plugin(observation))
  }
  print(results)
}

my_observation <- list(taxonID = 141433, decimalLongitude = 2, decimalLatitude = 53)
evaluate(my_observation, plugins = list(evaluate_speedy, evaluate_speciesgrids))

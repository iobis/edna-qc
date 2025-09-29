#' ednaqc
#'
#' @docType package
#' @name ednaqc
"_PACKAGE"

#' @import dplyr duckdb glue DBI
NULL

#' @export
evaluate_speedy <- function(observation) {
  speedy_path <- getOption("ednaqc.speedy_path")
  speedy_resolution <- getOption("ednaqc.speedy_resolution")
  file_path <- file.path(speedy_path, paste0(observation$taxonID, ".parquet"))
  con <- dbConnect(duckdb())
  scores <- dbGetQuery(con, glue("
    INSTALL h3 FROM community;
    LOAD h3;
    select density, suitability from read_parquet('{file_path}')
    where h3 = h3_latlng_to_cell_string({observation$decimalLatitude}, {observation$decimalLongitude}, {speedy_resolution})
  "))
  return(as.list(scores))
}

#' @export
evaluate_speciesgrids <- function(observation) {
  # TODO: add distribution to speedy output and remove this plugin
  speciesgrids_path <- getOption("ednaqc.speciesgrids_path")
  speedy_resolution <- getOption("ednaqc.speedy_resolution")
  file_path <- file.path(speciesgrids_path, "*")
  con <- dbConnect(duckdb())
  cells <- dbGetQuery(con, glue("
    install h3 from community;
    load h3;
    select count(distinct(h3_cell_to_parent(cell, {speedy_resolution}))) as cells from read_parquet('{file_path}')
    where AphiaID = {observation$taxonID}
  "))
  return(as.list(cells))
}

#' @export
evaluate <- function(observation, plugins) {
  results <- observation
  for (plugin in plugins) {
    results <- c(results, plugin(observation))
  }
  print(results)
}

devtools::load_all()
library(tidyr)
library(jsonlite)
library(taxidermist)
library(digest)

####################################################
# functions
####################################################

read_dataset <- function(occ_path, dna_path) {
  dna <- read.table(dna_path, sep = "\t", header = TRUE) %>% 
    select(occurrenceID, DNA_sequence)
  occ <- read.table(occ_path, sep = "\t", header = TRUE) %>% 
    filter(taxonRank == "species") %>% 
    mutate(
      taxonID = str_extract(scientificNameID, "\\d+$") %>% as.integer()
    ) %>% 
    select(scientificName, taxonID, decimalLongitude, decimalLatitude, occurrenceID, identificationRemarks) %>% 
    filter(!is.na(taxonID)) %>% 
    inner_join(dna, by = "occurrenceID")
  return(occ)
}

get_genera <- function(taxonID) {
  purrr::map(unique(taxonID), function(speciesid) {
    list(taxonID = speciesid, parentNameUsageID = worrms::wm_record(speciesid)$parentNameUsageID)
  }) %>%
    bind_rows() %>%
    mutate(parentNameUsageID = as.list(parentNameUsageID)) %>%
    tibble::deframe()
}

get_genus_species <- function(genusid) {
  worrms::wm_children(genusid, marine_only = FALSE) %>% 
    filter(status == "accepted" & rank == "Species") %>% 
    select(taxonID = AphiaID, scientificName = scientificname)
}

do_blast <- function(sequence) {
  temp_fasta <- tempfile(fileext = ".fasta")
  fasta_header <- ">seq"
  writeLines(c(fasta_header, sequence), temp_fasta)
  command <- glue("vsearch --usearch_global {temp_fasta} --db {refdb_path} --id 0.85 --blast6out temp.b6 --threads 4  --output_no_hits --query_cov 1 --maxaccepts 100 --maxrejects 100 --maxhits 100")
  system2(command, invisible = TRUE)
  raw_blast_results <- read.table("temp.b6", header = FALSE, sep = "\t", stringsAsFactors = FALSE)
  colnames(raw_blast_results) <- c("qseqid", "sseqid", "pident", "length", "mismatch", "gapopen", "qstart", "qend", "sstart", "send", "evalue", "bitscore")
  raw_blast_results %>%
    parse_taxonomy(sseqid) %>%
    # remove_unparsable_names() %>% 
    match_exact_worms()
}

####################################################
# configuration
####################################################

options(ednaqc.speedy_path = "/Volumes/acasis/speedy_output/edna_qc/parquet")
options(ednaqc.speciesgrids_path = "/Volumes/acasis/speciesgrids/h3_7")
options(ednaqc.speedy_resolution = 3)
options(ednaqc.refdb_names_path = "/Volumes/acasis/reference_databases/ncbi_coi_leray_names.parquet")
refdb_path <- "/Volumes/acasis/reference_databases/ncbi_coi_leray_pga_derep_filtered_sintax.fasta"
intercept <- -54.69092
slope <- 0.5631697

####################################################
# demo: single observation
####################################################

# my_observation <- list(taxonID = 141433, decimalLongitude = 2, decimalLatitude = 53)
# evaluate(my_observation, plugins = list(evaluate_speedy, evaluate_speciesgrids))

####################################################
# demo: full dataset spatial only
####################################################

# tsv
# TODO: rematch with taxidermist, check missing matches
# good results!
# occ_path <- "/Volumes/acasis/pipeline_results/ednaexpeditions_batch1_wadden_sea/runs/COI/05-dwca/Occurrence_table.tsv"
# also check Acanthistius patachonicus
# good results! Macrocystis pyrifera and Chloroparvula pacifica in Europe all from eDNA, Chloropicon roscoffensis	in Gulf of Mexico = eDNA, maybe Jania has good alternatives
occ_path <- "/Volumes/acasis/pipeline_results/ednaexpeditions_batch1_gulf_of_porto/runs/COI/05-dwca/Occurrence_table.tsv"
dna_path <- "/Volumes/acasis/pipeline_results/ednaexpeditions_batch1_gulf_of_porto/runs/COI/05-dwca/DNA_extension_table.tsv"
results_folder <- "output/scandola"

occ <- read_dataset(occ_path, dna_path)

process_row <- function(row) {
  tryCatch({
    evaluate(row, plugins = list(evaluate_speedy, evaluate_speciesgrids))
  },
  error = function(e) {
    print(glue("Error processing {row$scientificName} at {row$decimalLongitude} {row$decimalLatitude}"))
    return(NA)
  })
}

results <- occ %>%
  mutate(
    lon_rounded = round(decimalLongitude),
    lat_rounded = round(decimalLatitude)
  ) %>%
  group_by(scientificName, taxonID, lon_rounded, lat_rounded) %>%
  slice(1) %>%
  ungroup() %>%
  select(-lon_rounded, -lat_rounded) %>%
  transpose() %>%
  map(~process_row(.))
results <- results[!is.na(results)]
results <- bind_rows(results) %>%
  distinct()

writeLines(jsonlite::toJSON(results), file.path(results_folder, "results.json"))

####################################################
# demo: include sequence data
####################################################

#---------------------------------------------------
# export asvs per occurrence for the app
#---------------------------------------------------

asvs <- occ %>% 
  mutate(
    lon_rounded = round(decimalLongitude),
    lat_rounded = round(decimalLatitude)
  ) %>%
  group_by(taxonID, scientificName, DNA_sequence, lon_rounded, lat_rounded) %>%
  slice(1) %>%
  ungroup() %>%
  select(taxonID, scientificName, decimalLongitude, decimalLatitude, DNA_sequence)

asv_list <- asvs %>%
  mutate(coord = paste(decimalLongitude, decimalLatitude, sep = "_")) %>%
  group_by(taxonID, coord) %>%
  summarise(sequences = list(DNA_sequence), .groups = "drop_last") %>%
  nest(coord_sequences = c(coord, sequences)) %>%
  pull(coord_sequences, name = taxonID) %>%
  map(~ pull(.x, sequences, name = coord))

writeLines(jsonlite::toJSON(asv_list), file.path(results_folder, "asvs.json"))

#---------------------------------------------------
# per asv, evaluate all congenerics
# TODO: remove_unparsable_names in do_blast hanging for row 1!
# TODO: add species from other genera if they are more than 90%
#---------------------------------------------------

devtools::load_all()

for (i in 1:10) {
# for (i in 1:nrow(asvs)) {
  observation <- asvs %>% slice(i) %>% as.list()
  message(observation)
  congenerics <- observation$taxonID %>% get_genera() %>% unlist() %>% get_genus_species()
  congenerics$decimalLongitude <- observation$decimalLongitude
  congenerics$decimalLatitude <- observation$decimalLatitude
  blast_results <- do_blast(observation$DNA_sequence) %>% 
    mutate(taxonID = str_extract(scientificNameID, "\\d+$") %>% as.integer())
  blast_species <- blast_results %>% 
    arrange(taxonID, pident) %>% 
    group_by(taxonID) %>% 
    slice(1)
  congenerics <- congenerics %>% 
    left_join(blast_species %>% select(taxonID, pident), by = "taxonID")
  process_row <- function(row) {
    tryCatch({
      evaluate(row, plugins = list(evaluate_speedy, evaluate_speciesgrids, evaluate_identity, evaluate_refdb), intercept = intercept, slope = slope)
    },
    error = function(e) {
      print(glue("Error processing {row$scientificName} at {row$decimalLongitude} {row$decimalLatitude}"))
      return(NA)
    })
  }
  results_congenerics <- congenerics %>% 
    transpose() %>%
    map(~process_row(.)) %>% 
    bind_rows()

  short_hash <- digest(observation$DNA_sequence, algo = "sha256", serialize = FALSE)
  writeLines(jsonlite::toJSON(results_congenerics, na = "null"), file.path(results_folder, "congenerics", glue("{observation$taxonID}_{observation$decimalLongitude}_{observation$decimalLatitude}_{short_hash}.json")))
}



# debug
devtools::load_all()
rows <- congenerics %>% transpose()
row <- rows[[1]]
evaluate(row, plugins = list(evaluate_speedy, evaluate_speciesgrids, evaluate_identity, evaluate_refdb), intercept = intercept, slope = slope)
observation <- row
evaluate_speedy(row, intercept = intercept, slope = slope)
evaluate_speciesgrids(row, intercept = intercept, slope = slope)
evaluate_identity(row, intercept = intercept, slope = slope)
evaluate_refdb(row, intercept = intercept, slope = slope)

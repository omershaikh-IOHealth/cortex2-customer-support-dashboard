#!/usr/bin/env bash
# =============================================================================
# Add missing custom fields to IOH ClickUp lists
# Run this BEFORE running the migration or seed SQL.
# After running, paste the JSON responses so we can capture the new field UUIDs
# for solution_custom_fields seeding.
#
# Space:        IOH - test    (90126395854)
# Support list: IOH - Support (901215777514) → needs: Source only
# Testing list: IOH - Testing (901216234294) → needs: Request Type, Case Type, Source
# Dev list:     IOH - Dev     (901216234304) → needs: Request Type, Case Type, Source
# =============================================================================

TOKEN="pk_93735320_XU6SZJQGN677F46481KDAUGANNZU1GOT"

echo ""
echo "================================================================"
echo "1/7 — Add Source field to IOH - Support (901215777514)"
echo "================================================================"
curl -s -X POST "https://api.clickup.com/api/v2/list/901215777514/field" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Source",
    "type": "drop_down",
    "type_config": {
      "options": [
        {"name": "email",   "orderindex": 0},
        {"name": "voice",   "orderindex": 1},
        {"name": "apex",    "orderindex": 2},
        {"name": "clickup", "orderindex": 3}
      ]
    },
    "required": false
  }' 
echo ""

echo "================================================================"
echo "2/7 — Add Request Type to IOH - Testing (901216234294)"
echo "================================================================"
curl -s -X POST "https://api.clickup.com/api/v2/list/901216234294/field" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Request Type",
    "type": "drop_down",
    "type_config": {
      "options": [
        {"name": "Incident",        "orderindex": 0},
        {"name": "Service Request", "orderindex": 1},
        {"name": "Problem",         "orderindex": 2},
        {"name": "Change Request",  "orderindex": 3}
      ]
    },
    "required": false
  }' 
echo ""

echo "================================================================"
echo "3/7 — Add Case Type to IOH - Testing (901216234294)"
echo "================================================================"
curl -s -X POST "https://api.clickup.com/api/v2/list/901216234294/field" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Case Type",
    "type": "drop_down",
    "type_config": {
      "options": [
        {"name": "Availability",  "orderindex": 0},
        {"name": "Core Function", "orderindex": 1},
        {"name": "Integration",   "orderindex": 2},
        {"name": "Data Integrity","orderindex": 3},
        {"name": "Performance",   "orderindex": 4},
        {"name": "Stability",     "orderindex": 5},
        {"name": "Security",      "orderindex": 6},
        {"name": "UI / UX",       "orderindex": 7},
        {"name": "Support",       "orderindex": 8},
        {"name": "Access",        "orderindex": 9},
        {"name": "Problem Record","orderindex": 10},
        {"name": "Enhancement",   "orderindex": 11}
      ]
    },
    "required": false
  }' 
echo ""

echo "================================================================"
echo "4/7 — Add Source to IOH - Testing (901216234294)"
echo "================================================================"
curl -s -X POST "https://api.clickup.com/api/v2/list/901216234294/field" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Source",
    "type": "drop_down",
    "type_config": {
      "options": [
        {"name": "email",   "orderindex": 0},
        {"name": "voice",   "orderindex": 1},
        {"name": "apex",    "orderindex": 2},
        {"name": "clickup", "orderindex": 3}
      ]
    },
    "required": false
  }' 
echo ""

echo "================================================================"
echo "5/7 — Add Request Type to IOH - Dev (901216234304)"
echo "================================================================"
curl -s -X POST "https://api.clickup.com/api/v2/list/901216234304/field" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Request Type",
    "type": "drop_down",
    "type_config": {
      "options": [
        {"name": "Incident",        "orderindex": 0},
        {"name": "Service Request", "orderindex": 1},
        {"name": "Problem",         "orderindex": 2},
        {"name": "Change Request",  "orderindex": 3}
      ]
    },
    "required": false
  }' 
echo ""

echo "================================================================"
echo "6/7 — Add Case Type to IOH - Dev (901216234304)"
echo "================================================================"
curl -s -X POST "https://api.clickup.com/api/v2/list/901216234304/field" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Case Type",
    "type": "drop_down",
    "type_config": {
      "options": [
        {"name": "Availability",  "orderindex": 0},
        {"name": "Core Function", "orderindex": 1},
        {"name": "Integration",   "orderindex": 2},
        {"name": "Data Integrity","orderindex": 3},
        {"name": "Performance",   "orderindex": 4},
        {"name": "Stability",     "orderindex": 5},
        {"name": "Security",      "orderindex": 6},
        {"name": "UI / UX",       "orderindex": 7},
        {"name": "Support",       "orderindex": 8},
        {"name": "Access",        "orderindex": 9},
        {"name": "Problem Record","orderindex": 10},
        {"name": "Enhancement",   "orderindex": 11}
      ]
    },
    "required": false
  }' 
echo ""

echo "================================================================"
echo "7/7 — Add Source to IOH - Dev (901216234304)"
echo "================================================================"
curl -s -X POST "https://api.clickup.com/api/v2/list/901216234304/field" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Source",
    "type": "drop_down",
    "type_config": {
      "options": [
        {"name": "email",   "orderindex": 0},
        {"name": "voice",   "orderindex": 1},
        {"name": "apex",    "orderindex": 2},
        {"name": "clickup", "orderindex": 3}
      ]
    },
    "required": false
  }' 
echo ""

echo "================================================================"
echo "DONE. Paste the 7 JSON responses back so the field UUIDs can be"
echo "captured and inserted into solution_custom_fields in the seed SQL."
echo "================================================================"
